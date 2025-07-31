const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Tracking Service',
    version: '1.0.0',
    description: 'API para rastreamento em tempo real de motoristas'
  }
};

const options = {
  swaggerDefinition,
  apis: ['./index.js'],
};

const swaggerSpec = swaggerJsdoc(options);

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.json());
app.use(cors({ origin: 'http://localhost:8080', credentials: true }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Armazenar conexões WebSocket por empresa
const connections = new Map();

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

// WebSocket para rastreamento em tempo real
wss.on('connection', (ws, req) => {
  console.log('Nova conexão WebSocket estabelecida');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'auth') {
        // Autenticar conexão WebSocket
        const decoded = jwt.verify(data.token, "fda76ff877a92f9a86e7831fad372e2d9e777419e155aab4f5b18b37d280d05a");
        ws.user = decoded;
        ws.companyId = decoded.company_id;
        
        // Adicionar à lista de conexões da empresa
        if (!connections.has(decoded.company_id)) {
          connections.set(decoded.company_id, new Set());
        }
        connections.get(decoded.company_id).add(ws);
        
        ws.send(JSON.stringify({ type: 'auth_success' }));
      }
      
      if (data.type === 'location_update') {
        // Salvar localização no banco
        await saveLocation(data);
        
        // Broadcast para outros usuários da mesma empresa
        broadcastToCompany(ws.companyId, {
          type: 'location_update',
          driver_id: data.driver_id,
          location: data.location,
          timestamp: new Date().toISOString()
        });
      }
      
    } catch (error) {
      console.error('Erro no WebSocket:', error);
      ws.send(JSON.stringify({ type: 'error', message: error.message }));
    }
  });

  ws.on('close', () => {
    if (ws.companyId && connections.has(ws.companyId)) {
      connections.get(ws.companyId).delete(ws);
    }
  });
});

// Função para salvar localização no banco
async function saveLocation(data) {
  try {
    await pool.query(`
      INSERT INTO tracking_points (driver_id, company_id, latitude, longitude, accuracy, speed, heading, delivery_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [
      data.driver_id,
      data.company_id,
      data.location.latitude,
      data.location.longitude,
      data.location.accuracy || null,
      data.location.speed || null,
      data.location.heading || null,
      data.delivery_id || null
    ]);
  } catch (error) {
    console.error('Erro ao salvar localização:', error);
  }
}

// Função para broadcast para empresa
function broadcastToCompany(companyId, message) {
  if (connections.has(companyId)) {
    connections.get(companyId).forEach(client => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(message));
      }
    });
  }
}

/**
 * @swagger
 * /api/tracking/location:
 *   post:
 *     summary: Enviar localização do motorista
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               driver_id:
 *                 type: string
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               accuracy:
 *                 type: number
 *               speed:
 *                 type: number
 *               heading:
 *                 type: number
 *               delivery_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Localização enviada com sucesso
 */
app.post('/api/tracking/location', authorize(['DRIVER']), async (req, res) => {
  try {
    const { driver_id, latitude, longitude, accuracy, speed, heading, delivery_id } = req.body;

    // Verificar se o motorista existe e pertence à empresa
    const [driverRows] = await pool.query(
      'SELECT * FROM drivers WHERE id = ? AND company_id = ?',
      [driver_id, req.user.company_id]
    );

    if (driverRows.length === 0) {
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }

    // Salvar localização
    await pool.query(`
      INSERT INTO tracking_points (driver_id, company_id, latitude, longitude, accuracy, speed, heading, delivery_id, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
    `, [driver_id, req.user.company_id, latitude, longitude, accuracy, speed, heading, delivery_id || null]);

    // Broadcast para outros usuários da empresa
    broadcastToCompany(req.user.company_id, {
      type: 'location_update',
      driver_id,
      location: { latitude, longitude, accuracy, speed, heading },
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Localização enviada com sucesso' });

  } catch (error) {
    console.error('Erro ao enviar localização:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/tracking/drivers/current-locations:
 *   get:
 *     summary: Obter localizações atuais de todos os motoristas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Localizações dos motoristas
 */
app.get('/api/tracking/drivers/current-locations', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        d.id as driver_id,
        u.full_name as driver_name,
        tp.latitude,
        tp.longitude,
        tp.accuracy,
        tp.speed,
        tp.heading,
        tp.timestamp as last_update,
        CASE 
          WHEN tp.timestamp > DATE_SUB(NOW(), INTERVAL 5 MINUTE) THEN 'active'
          ELSE 'inactive'
        END as status,
        dn.id as current_delivery_id,
        dn.client_name_extracted as current_delivery_client
      FROM drivers d
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN (
        SELECT driver_id, MAX(timestamp) as max_timestamp
        FROM tracking_points 
        WHERE company_id = ?
        GROUP BY driver_id
      ) latest ON d.id = latest.driver_id
      LEFT JOIN tracking_points tp ON d.id = tp.driver_id AND tp.timestamp = latest.max_timestamp
      LEFT JOIN delivery_notes dn ON d.id = dn.driver_id AND dn.status IN ('PENDING', 'IN_TRANSIT')
      WHERE d.company_id = ?
      ORDER BY tp.timestamp DESC
    `, [req.user.company_id, req.user.company_id]);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erro ao obter localizações:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/tracking/drivers/{driverId}/history:
 *   get:
 *     summary: Obter histórico de rastreamento do motorista
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Histórico de rastreamento
 */
app.get('/api/tracking/drivers/:driverId/history', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const { driverId } = req.params;
    const { start_date, end_date } = req.query;

    let query = `
      SELECT 
        timestamp,
        latitude,
        longitude,
        accuracy,
        speed,
        heading,
        delivery_id
      FROM tracking_points 
      WHERE driver_id = ? AND company_id = ?
    `;
    const params = [driverId, req.user.company_id];

    if (start_date) {
      query += ' AND timestamp >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND timestamp <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY timestamp DESC LIMIT 1000';

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erro ao obter histórico:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/tracking/drivers/{driverId}/status:
 *   put:
 *     summary: Atualizar status do motorista
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: driverId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [online, offline, busy, available]
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 */
app.put('/api/tracking/drivers/:driverId/status', authorize(['DRIVER', 'ADMIN']), async (req, res) => {
  try {
    const { driverId } = req.params;
    const { status } = req.body;

    // Verificar se o motorista existe e pertence à empresa
    const [driverRows] = await pool.query(
      'SELECT * FROM drivers WHERE id = ? AND company_id = ?',
      [driverId, req.user.company_id]
    );

    if (driverRows.length === 0) {
      return res.status(404).json({ error: 'Motorista não encontrado' });
    }

    // Atualizar status
    await pool.query(
      'UPDATE drivers SET status = ?, last_status_update = NOW() WHERE id = ?',
      [status, driverId]
    );

    // Broadcast para outros usuários da empresa
    broadcastToCompany(req.user.company_id, {
      type: 'driver_status',
      driver_id: driverId,
      status,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Status atualizado com sucesso' });

  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: error.message });
  }
});

if (require.main === module) {
  server.listen(3005, () => console.log('Tracking Service rodando na porta 3005'));
}

module.exports = app; 