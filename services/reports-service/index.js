const express = require('express');
const pool = require('../../shared/db');
const app = express();
app.use(express.json());

const cors = require('cors');

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Reports',
    version: '1.0.0',
    description: 'Documentação da API de relatórios'
  }
};
const options = {
  swaggerDefinition,
  apis: ['./index.js'],
};
const swaggerSpec = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(cors({ origin: '*', credentials: true }));

/**
 * @swagger
 * /api/reports/deliveries:
 *   get:
 *     summary: Relatório de entregas realizadas
 *     parameters:
 *       - in: query
 *         name: data
 *         schema:
 *           type: string
 *         description: Data da entrega
 *       - in: query
 *         name: cliente
 *         schema:
 *           type: string
 *         description: ID do cliente
 *       - in: query
 *         name: motorista
 *         schema:
 *           type: string
 *         description: ID do motorista
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Status da entrega
 *     responses:
 *       200:
 *         description: Lista de entregas
 */
// Relatório de entregas realizadas com filtros
app.get('/api/reports/deliveries', async (req, res) => {
  const { data, cliente, motorista, status } = req.query;
  let sql = 'SELECT * FROM delivery_notes WHERE status = "DELIVERED"';
  const params = [];
  if (data) {
    sql += ' AND delivery_date_expected = ?';
    params.push(data);
  }
  if (cliente) {
    sql += ' AND client_id = ?';
    params.push(cliente);
  }
  if (motorista) {
    sql += ' AND id IN (SELECT delivery_note_id FROM route_deliveries rd JOIN routes r ON rd.route_id = r.id WHERE r.driver_id = ?)';
    params.push(motorista);
  }
  if (status) {
    sql = sql.replace('status = "DELIVERED"', 'status = ?');
    params.unshift(status);
  }
  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Relatório de ocorrências
app.get('/api/reports/occurrences', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM delivery_notes WHERE status IN ("PROBLEM", "REFUSED", "REATTEMPTED")');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Relatório de comprovantes
app.get('/api/reports/receipts-status', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT dn.id, dn.nf_number, dr.id AS receipt_id, dr.photo_datetime
      FROM delivery_notes dn
      LEFT JOIN delivery_receipts dr ON dn.id = dr.delivery_note_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Relatório de desempenho por motorista
app.get('/api/reports/driver-performance', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.driver_id, COUNT(rd.delivery_note_id) AS total_entregas
      FROM routes r
      JOIN route_deliveries rd ON r.id = rd.route_id
      GROUP BY r.driver_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Histórico de rotas
app.get('/api/reports/tracking-history', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM tracking_points');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Relatório por cliente
app.get('/api/reports/client-volume', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT client_id, COUNT(*) AS total_entregas, SUM(merchandise_value) AS valor_total
      FROM delivery_notes
      GROUP BY client_id
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Status diário das entregas
app.get('/api/reports/daily-status', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT status, COUNT(*) AS total
      FROM delivery_notes
      WHERE delivery_date_expected = CURDATE()
      GROUP BY status
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(3006, () => console.log('Reports Service rodando na porta 3006'));
}
module.exports = app; 