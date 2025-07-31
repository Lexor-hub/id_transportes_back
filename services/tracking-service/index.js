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
    title: 'API Tracking',
    version: '1.0.0',
    description: 'Documentação da API de rastreamento'
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
 * /api/tracking/location:
 *   post:
 *     summary: Registrar localização do motorista
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               route_id:
 *                 type: integer
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *               timestamp:
 *                 type: string
 *               speed_kmh:
 *                 type: number
 *               event_type:
 *                 type: string
 *               associated_delivery_id:
 *                 type: integer
 *     responses:
 *       201:
 *         description: Localização registrada
 */
// Registrar localização
app.post('/api/tracking/location', async (req, res) => {
  const { route_id, latitude, longitude, timestamp, speed_kmh, event_type, associated_delivery_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO tracking_points (route_id, latitude, longitude, timestamp, speed_kmh, event_type, associated_delivery_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [route_id, latitude, longitude, timestamp, speed_kmh, event_type, associated_delivery_id]
    );
    res.status(201).json({ message: 'Localização registrada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Histórico de rota de um motorista
app.get('/api/tracking/drivers/:driverId/history', async (req, res) => {
  const { driverId } = req.params;
  try {
    const [routes] = await pool.query('SELECT id FROM routes WHERE driver_id = ?', [driverId]);
    if (routes.length === 0) return res.json([]);
    const routeIds = routes.map(r => r.id);
    const [points] = await pool.query('SELECT * FROM tracking_points WHERE route_id IN (?)', [routeIds]);
    res.json(points);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Localização atual de todos os motoristas
app.get('/api/tracking/drivers/current-locations', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT r.driver_id, t.latitude, t.longitude, t.timestamp
      FROM tracking_points t
      JOIN routes r ON t.route_id = r.id
      WHERE t.id IN (
        SELECT MAX(id) FROM tracking_points GROUP BY route_id
      )
    `);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Registrar evento de rastreamento
app.post('/api/tracking/event', async (req, res) => {
  const { route_id, event_type, associated_delivery_id } = req.body;
  try {
    await pool.query(
      'INSERT INTO tracking_points (route_id, event_type, associated_delivery_id, timestamp) VALUES (?, ?, ?, NOW())',
      [route_id, event_type, associated_delivery_id]
    );
    res.status(201).json({ message: 'Evento registrado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(3005, () => console.log('Tracking Service rodando na porta 3005'));
}
module.exports = app; 