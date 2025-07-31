const express = require('express');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Reports Service',
    version: '1.0.0',
    description: 'API para relatórios avançados e dashboards'
  }
};

const options = {
  swaggerDefinition,
  apis: ['./index.js'],
};

const swaggerSpec = swaggerJsdoc(options);

const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:8080', credentials: true }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Middleware de autenticação
function authorize(roles = []) {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Token não fornecido' });
    const token = auth.split(' ')[1];
    try {
      const decoded = jwt.verify(token, "fda76ff877a92f9a86e7831fad372e2d9e777419e155aab4f5b18b37d280d05a");
      if (roles.length && !roles.includes(decoded.user_type)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Token inválido' });
    }
  };
}

/**
 * @swagger
 * /api/reports/deliveries:
 *   get:
 *     summary: Relatório de entregas
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *       - in: query
 *         name: driver_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Relatório de entregas
 */
app.get('/api/reports/deliveries', authorize(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const { start_date, end_date, driver_id, client_id, status } = req.query;
    
    let whereClause = 'WHERE d.company_id = ?';
    const params = [req.user.company_id];

    if (start_date) {
      whereClause += ' AND DATE(d.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      whereClause += ' AND DATE(d.created_at) <= ?';
      params.push(end_date);
    }

    if (driver_id) {
      whereClause += ' AND d.driver_id = ?';
      params.push(driver_id);
    }

    if (client_id) {
      whereClause += ' AND d.client_id = ?';
      params.push(client_id);
    }

    if (status) {
      whereClause += ' AND d.status = ?';
      params.push(status);
    }

    // Resumo geral
    const [summaryRows] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status IN ('PENDING', 'IN_TRANSIT') THEN 1 ELSE 0 END) as pending,
        SUM(CASE WHEN status = 'CANCELLED' THEN 1 ELSE 0 END) as cancelled,
        SUM(CASE WHEN status = 'REFUSED' THEN 1 ELSE 0 END) as refused,
        AVG(CASE WHEN status = 'DELIVERED' THEN TIMESTAMPDIFF(MINUTE, created_at, updated_at) END) as avg_delivery_time
      FROM delivery_notes d
      ${whereClause}
    `, params);

    // Progresso diário
    const [dailyProgressRows] = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as total,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status IN ('PENDING', 'IN_TRANSIT') THEN 1 ELSE 0 END) as pending
      FROM delivery_notes d
      ${whereClause}
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, params);

    // Distribuição por status
    const [statusDistributionRows] = await pool.query(`
      SELECT 
        status,
        COUNT(*) as count,
        ROUND(COUNT(*) * 100.0 / (SELECT COUNT(*) FROM delivery_notes d ${whereClause}), 2) as percentage
      FROM delivery_notes d
      ${whereClause}
      GROUP BY status
    `, params);

    // Performance por motorista
    const [driverPerformanceRows] = await pool.query(`
      SELECT 
        u.full_name as driver_name,
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
        ROUND(SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate,
        AVG(CASE WHEN d.status = 'DELIVERED' THEN TIMESTAMPDIFF(MINUTE, d.created_at, d.updated_at) END) as avg_delivery_time
      FROM delivery_notes d
      LEFT JOIN users u ON d.driver_id = u.id
      ${whereClause}
      GROUP BY d.driver_id, u.full_name
      ORDER BY success_rate DESC
    `, params);

    res.json({
      success: true,
      data: {
        summary: summaryRows[0],
        daily_progress: dailyProgressRows,
        status_distribution: statusDistributionRows,
        driver_performance: driverPerformanceRows
      }
    });

  } catch (error) {
    console.error('Erro ao gerar relatório de entregas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/reports/driver-performance:
 *   get:
 *     summary: Relatório de desempenho por motorista
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: driver_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Relatório de desempenho
 */
app.get('/api/reports/driver-performance', authorize(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const { start_date, end_date, driver_id } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date e end_date são obrigatórios' });
    }

    let whereClause = 'WHERE d.company_id = ? AND DATE(d.created_at) BETWEEN ? AND ?';
    const params = [req.user.company_id, start_date, end_date];

    if (driver_id) {
      whereClause += ' AND d.driver_id = ?';
      params.push(driver_id);
    }

    const [rows] = await pool.query(`
      SELECT 
        d.driver_id,
        u.full_name as driver_name,
        COUNT(*) as total_deliveries,
        SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
        ROUND(SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate,
        AVG(CASE WHEN d.status = 'DELIVERED' THEN TIMESTAMPDIFF(MINUTE, d.created_at, d.updated_at) END) as average_time,
        COUNT(o.id) as occurrences,
        ROUND(COUNT(o.id) * 100.0 / COUNT(*), 2) as occurrence_rate,
        ROUND(
          (SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) * 0.7 +
          (100 - AVG(CASE WHEN d.status = 'DELIVERED' THEN TIMESTAMPDIFF(MINUTE, d.created_at, d.updated_at) END) / 60) * 0.2 +
          (100 - COUNT(o.id) * 100.0 / COUNT(*)) * 0.1
        , 2) as performance_score
      FROM delivery_notes d
      LEFT JOIN users u ON d.driver_id = u.id
      LEFT JOIN delivery_occurrences o ON d.id = o.delivery_id
      ${whereClause}
      GROUP BY d.driver_id, u.full_name
      ORDER BY performance_score DESC
    `, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erro ao gerar relatório de desempenho:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/reports/client-volume:
 *   get:
 *     summary: Relatório por cliente
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: start_date
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: end_date
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: client_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Relatório por cliente
 */
app.get('/api/reports/client-volume', authorize(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const { start_date, end_date, client_id } = req.query;
    
    if (!start_date || !end_date) {
      return res.status(400).json({ error: 'start_date e end_date são obrigatórios' });
    }

    let whereClause = 'WHERE d.company_id = ? AND DATE(d.created_at) BETWEEN ? AND ?';
    const params = [req.user.company_id, start_date, end_date];

    if (client_id) {
      whereClause += ' AND d.client_id = ?';
      params.push(client_id);
    }

    const [rows] = await pool.query(`
      SELECT 
        d.client_id,
        c.name as client_name,
        COUNT(*) as total_deliveries,
        SUM(d.merchandise_value) as total_value,
        AVG(d.merchandise_value) as average_value,
        SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END) as completed_deliveries,
        ROUND(SUM(CASE WHEN d.status = 'DELIVERED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as success_rate,
        ROUND(
          (COUNT(*) - LAG(COUNT(*)) OVER (ORDER BY DATE(d.created_at))) * 100.0 / 
          NULLIF(LAG(COUNT(*)) OVER (ORDER BY DATE(d.created_at)), 0)
        , 2) as growth_rate
      FROM delivery_notes d
      LEFT JOIN clients c ON d.client_id = c.id
      ${whereClause}
      GROUP BY d.client_id, c.name
      ORDER BY total_value DESC
    `, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erro ao gerar relatório por cliente:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/dashboard/kpis:
 *   get:
 *     summary: KPIs do dashboard
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: KPIs do dashboard
 */
app.get('/api/dashboard/kpis', authorize(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Entregas de hoje
    const [todayDeliveries] = await pool.query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status IN ('PENDING', 'IN_TRANSIT') THEN 1 ELSE 0 END) as pending
      FROM delivery_notes 
      WHERE company_id = ? AND DATE(created_at) = CURDATE()
    `, [companyId]);

    // Motoristas ativos
    const [activeDrivers] = await pool.query(`
      SELECT COUNT(*) as count
      FROM drivers 
      WHERE company_id = ? AND status = 'active'
    `, [companyId]);

    // Ocorrências pendentes
    const [pendingOccurrences] = await pool.query(`
      SELECT COUNT(*) as count
      FROM delivery_occurrences 
      WHERE company_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    `, [companyId]);

    // Score de performance (média dos motoristas)
    const [performanceScore] = await pool.query(`
      SELECT ROUND(AVG(
        (SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)) * 0.7 +
        (100 - AVG(CASE WHEN status = 'DELIVERED' THEN TIMESTAMPDIFF(MINUTE, created_at, updated_at) END) / 60) * 0.2 +
        (100 - (SELECT COUNT(*) FROM delivery_occurrences o WHERE o.delivery_id = d.id) * 100.0 / COUNT(*)) * 0.1
      ), 2) as score
      FROM delivery_notes d
      WHERE company_id = ? AND DATE(created_at) = CURDATE()
      GROUP BY driver_id
    `, [companyId]);

    // Receita de hoje
    const [revenueToday] = await pool.query(`
      SELECT SUM(merchandise_value) as total
      FROM delivery_notes 
      WHERE company_id = ? AND DATE(created_at) = CURDATE() AND status = 'DELIVERED'
    `, [companyId]);

    // Taxa de eficiência
    const [efficiencyRate] = await pool.query(`
      SELECT ROUND(
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)
      , 2) as rate
      FROM delivery_notes 
      WHERE company_id = ? AND DATE(created_at) = CURDATE()
    `, [companyId]);

    res.json({
      success: true,
      data: {
        today_deliveries: todayDeliveries[0],
        active_drivers: activeDrivers[0].count,
        pending_occurrences: pendingOccurrences[0].count,
        performance_score: performanceScore[0]?.score || 0,
        revenue_today: revenueToday[0].total || 0,
        efficiency_rate: efficiencyRate[0].rate || 0
      }
    });

  } catch (error) {
    console.error('Erro ao obter KPIs:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/dashboard/company-stats:
 *   get:
 *     summary: Estatísticas da empresa
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Estatísticas da empresa
 */
app.get('/api/dashboard/company-stats', authorize(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const companyId = req.user.company_id;

    // Crescimento mensal
    const [monthlyGrowth] = await pool.query(`
      SELECT ROUND(
        (COUNT(*) - LAG(COUNT(*)) OVER (ORDER BY YEAR(created_at), MONTH(created_at))) * 100.0 / 
        NULLIF(LAG(COUNT(*)) OVER (ORDER BY YEAR(created_at), MONTH(created_at)), 0)
      , 2) as growth
      FROM delivery_notes 
      WHERE company_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 2 MONTH)
      GROUP BY YEAR(created_at), MONTH(created_at)
      ORDER BY YEAR(created_at) DESC, MONTH(created_at) DESC
      LIMIT 1
    `, [companyId]);

    // Eficiência dos motoristas
    const [driverEfficiency] = await pool.query(`
      SELECT ROUND(AVG(
        SUM(CASE WHEN status = 'DELIVERED' THEN 1 ELSE 0 END) * 100.0 / COUNT(*)
      ), 2) as efficiency
      FROM delivery_notes 
      WHERE company_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY driver_id
    `, [companyId]);

    // Satisfação dos clientes (baseado em ocorrências)
    const [clientSatisfaction] = await pool.query(`
      SELECT ROUND(
        (COUNT(DISTINCT d.id) - COUNT(DISTINCT o.delivery_id)) * 100.0 / COUNT(DISTINCT d.id)
      , 2) as satisfaction
      FROM delivery_notes d
      LEFT JOIN delivery_occurrences o ON d.id = o.delivery_id
      WHERE d.company_id = ? AND d.created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `, [companyId]);

    // Tendência de receita
    const [revenueTrend] = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        SUM(merchandise_value) as revenue
      FROM delivery_notes 
      WHERE company_id = ? AND status = 'DELIVERED' AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [companyId]);

    // Tendência de entregas
    const [deliveryTrend] = await pool.query(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as deliveries
      FROM delivery_notes 
      WHERE company_id = ? AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date DESC
      LIMIT 30
    `, [companyId]);

    res.json({
      success: true,
      data: {
        monthly_growth: monthlyGrowth[0]?.growth || 0,
        driver_efficiency: driverEfficiency[0]?.efficiency || 0,
        client_satisfaction: clientSatisfaction[0]?.satisfaction || 0,
        revenue_trend: revenueTrend,
        delivery_trend: deliveryTrend
      }
    });

  } catch (error) {
    console.error('Erro ao obter estatísticas:', error);
    res.status(500).json({ error: error.message });
  }
});

if (require.main === module) {
  app.listen(3006, () => console.log('Reports Service rodando na porta 3006'));
}

module.exports = app; 