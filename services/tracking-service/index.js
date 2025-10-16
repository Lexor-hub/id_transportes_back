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
const defaultOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:8081',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
];

const envOrigins = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

const wildcardOrigins = envOrigins.filter((origin) => origin.includes('*'));
const explicitOrigins = envOrigins.filter((origin) => !origin.includes('*'));

const allowedOriginPatterns = [
  /^https:\/\/transportes-.*\.vercel\.app$/,
  /^https:\/\/idtransportes-.*\.vercel\.app$/,
  /^https:\/\/trasportes-.*\.vercel\.app$/,
  ...wildcardOrigins.map((pattern) => {
    const escaped = pattern
      .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
      .replace(/\\\*/g, '.*');
    return new RegExp(`^${escaped}$`);
  }),
];

const whitelist = [...defaultOrigins, ...explicitOrigins, ...allowedOriginPatterns];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);

    const isAllowed = whitelist.some((pattern) =>
      pattern instanceof RegExp ? pattern.test(origin) : pattern === origin
    ) || /\.vercel\.app$/i.test(origin) || /\.railway\.app$/i.test(origin);

    if (!isAllowed) {
      console.warn(`[Tracking CORS] Allowing unlisted origin '${origin}'. Configure CORS_ALLOWED_ORIGINS if this is unintended.`);
    }

    callback(null, true);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else {
    res.header('Access-Control-Allow-Origin', '*');
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(204);
  }
  next();
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Armazenar conexões WebSocket por empresa
const connections = new Map();

const driverVehicleMap = new Map(); // driver_id -> { vehicleId, vehicleLabel, companyId, updatedAt }
async function persistTrackingPoint({ driverId, companyId, vehicleId, latitude, longitude, accuracy, speed, heading, deliveryId }) {
  const fallbackQuery = `INSERT INTO tracking_points (driver_id, company_id, latitude, longitude, accuracy, speed, heading, delivery_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`;
  const fallbackParams = [driverId, companyId, latitude, longitude, accuracy, speed, heading, deliveryId];

  if (vehicleId !== null && vehicleId !== undefined) {
    try {
      await pool.execute(`INSERT INTO tracking_points (driver_id, company_id, vehicle_id, latitude, longitude, accuracy, speed, heading, delivery_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [driverId, companyId, Number(vehicleId), latitude, longitude, accuracy, speed, heading, deliveryId]);
      return;
    } catch (error) {
      if (error && (error.code === 'ER_BAD_FIELD_ERROR' || error.code === 'ER_WRONG_VALUE_COUNT_ON_ROW')) {
        console.warn('[Tracking] Tabela tracking_points sem coluna vehicle_id. Gravando sem o campo.');
      } else {
        throw error;
      }
    }
  }

  await pool.execute(fallbackQuery, fallbackParams);
}


async function rememberVehicle(driverId, companyId, vehicleId) {
  if (vehicleId === undefined || vehicleId === null || vehicleId === '') {
    return;
  }

  const driverKey = String(driverId);
  const vehicleIdStr = String(vehicleId);
  const existing = driverVehicleMap.get(driverKey);
  if (existing && existing.vehicleId === vehicleIdStr) {
    driverVehicleMap.set(driverKey, { ...existing, updatedAt: new Date().toISOString() });
    return;
  }

  let vehicleLabel = null;
  try {
    const [rows] = await pool.query('SELECT plate, model, brand FROM vehicles WHERE id = ? LIMIT 1', [vehicleIdStr]);
    if (Array.isArray(rows) && rows.length > 0) {
      const record = rows[0];
      const parts = [];
      if (record.plate) parts.push(String(record.plate).toUpperCase());
      if (record.model) parts.push(String(record.model));
      if (parts.length === 0 && record.brand) parts.push(String(record.brand));
      if (parts.length) {
        vehicleLabel = parts.join(' - ');
      }
    }
  } catch (error) {
    console.warn('[Tracking] Failed to resolve vehicle information:', error.message);
  }

  driverVehicleMap.set(driverKey, {
    vehicleId: vehicleIdStr,
    vehicleLabel: vehicleLabel ?? `Veiculo ${vehicleIdStr}`,
    companyId: companyId ? String(companyId) : null,
    updatedAt: new Date().toISOString(),
  });
}

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
    await persistTrackingPoint({
      driverId: data.driver_id,
      companyId: data.company_id,
      vehicleId: data.vehicle_id ?? null,
      latitude: data.location.latitude,
      longitude: data.location.longitude,
      accuracy: data.location.accuracy || null,
      speed: data.location.speed || null,
      heading: data.location.heading || null,
      deliveryId: data.delivery_id || null,
    });
  } catch (error) {
    console.error('Erro ao salvar localizacao:', error);
  }

  try {
    await rememberVehicle(data.driver_id, data.company_id, data.vehicle_id);
  } catch (error) {
    console.warn('[Tracking] Nao foi possivel atualizar o veiculo do motorista:', error && error.message ? error.message : error);
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
        const { latitude, longitude, accuracy, speed, heading, delivery_id, vehicle_id: vehicleIdBody, vehicleId } = req.body;
        const vehicle_id = vehicleIdBody ?? vehicleId ?? null;
        const company_id = req.user.company_id;
        const user_id = req.user.id; // Pega o user_id do token JWT

        // Busca o driver_id correspondente ao user_id
        const [driverRows] = await pool.query('SELECT id FROM drivers WHERE user_id = ? AND company_id = ?', [user_id, company_id]);

        if (driverRows.length === 0) {
            console.warn(`[Tracking] Tentativa de salvar localização para um usuário sem registro de motorista. User ID: ${user_id}`);
            return res.status(404).json({ error: 'Motorista não encontrado para este usuário.' });
        }
        const driver_id = driverRows[0].id; // Este é o ID correto para a tabela tracking_points
        if (vehicle_id !== null && vehicle_id !== undefined) {
            await rememberVehicle(driver_id, company_id, vehicle_id);
        }

        const parsedLatitude = latitude === undefined || latitude === null ? null : Number(latitude);
        const parsedLongitude = longitude === undefined || longitude === null ? null : Number(longitude);
        const rawAccuracy = accuracy === undefined || accuracy === null ? null : Number(accuracy);
        const parsedAccuracy = rawAccuracy !== null && Number.isFinite(rawAccuracy) && rawAccuracy >= 0 ? rawAccuracy : null;
        const sanitizedAccuracy = parsedAccuracy !== null ? Math.min(parsedAccuracy, 999.99) : null;
        const parsedSpeed = typeof speed === 'number' && Number.isFinite(speed) ? speed : null;
        const parsedHeading = typeof heading === 'number' && Number.isFinite(heading) ? heading : null;
        const parsedDeliveryId = delivery_id ?? null;

        console.log('[Tracking] Recebido ping de localização', {
            driver_id,
            company_id,
            user_id,
            latitude,
            longitude,
            accuracy: sanitizedAccuracy,
            rawAccuracy: parsedAccuracy,
            speed,
            heading,
            delivery_id,
            timestamp: new Date().toISOString(),
        });

        if (!driver_id || parsedLatitude === null || Number.isNaN(parsedLatitude) || parsedLongitude === null || Number.isNaN(parsedLongitude) || !company_id) {
            return res.status(400).json({ error: 'Dados de localização incompletos' });
        }

        // Insere a localização na tabela tracking_points
        await persistTrackingPoint({
          driverId: driver_id,
          companyId: company_id,
          vehicleId: vehicle_id ?? null,
          latitude: parsedLatitude,
          longitude: parsedLongitude,
          accuracy: sanitizedAccuracy,
          speed: parsedSpeed,
          heading: parsedHeading,
          deliveryId: parsedDeliveryId,
        });

        console.log('[Tracking] Localização persistida', { driver_id, company_id });
        res.status(200).json({ success: true, message: 'Localização salva com sucesso' });
    } catch (error) {
        console.error('Erro ao salvar localização:', error);
        res.status(500).json({ error: 'Erro interno ao salvar localização', details: error.message });
    }
});

app.post('/api/tracking/driver/vehicle', authorize(['DRIVER']), async (req, res) => {
  try {
    const vehicleIdValue = req.body?.vehicle_id ?? req.body?.vehicleId ?? req.body?.id;
    if (vehicleIdValue === undefined || vehicleIdValue === null || vehicleIdValue === '') {
      return res.status(400).json({ success: false, error: 'vehicle_id obrigatorio' });
    }

    const company_id = req.user.company_id;
    const user_id = req.user.id;

    const [driverRows] = await pool.query('SELECT id FROM drivers WHERE user_id = ? AND company_id = ?', [user_id, company_id]);

    if (!Array.isArray(driverRows) || driverRows.length === 0) {
      return res.status(404).json({ success: false, error: 'Motorista nao encontrado para este usuario.' });
    }

    const driver_id = driverRows[0].id;
    await rememberVehicle(driver_id, company_id, vehicleIdValue);

    res.json({ success: true });
  } catch (error) {
    console.error('[Tracking] Falha ao registrar veiculo ativo:', error);
    res.status(500).json({ success: false, error: 'Erro interno ao registrar veiculo ativo.' });
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
 *         description: LocalizaÃƒÆ’Ã‚Â§ÃƒÆ’Ã‚Âµes dos motoristas
 */
app.get('/api/tracking/drivers/current-locations', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    console.log('[Tracking] Buscando localizações atuais', { company_id: req.user.company_id });
    const [rows] = await pool.query(`
      SELECT 
        d.id as driver_id,
        u.full_name as driver_name,
        tp.vehicle_id as vehicle_id,
        tp.latitude,
        tp.longitude,
        tp.accuracy,
        tp.speed,
        tp.heading,
        tp.timestamp as last_update,
        IF(tp.timestamp < DATE_SUB(NOW(), INTERVAL 10 MINUTE), 'idle', 'active') as activity_status,
        d.status,
        del.id as current_delivery_id,
        del.client_name as current_delivery_client
      FROM drivers d
      INNER JOIN (
        SELECT driver_id, MAX(timestamp) as max_timestamp
        FROM tracking_points 
        WHERE company_id = ?
          AND timestamp >= DATE_SUB(NOW(), INTERVAL 2 HOUR) -- Aumenta a janela de busca para 2 horas
        GROUP BY driver_id
      ) latest ON latest.driver_id = d.id
      INNER JOIN tracking_points tp ON tp.driver_id = latest.driver_id AND tp.timestamp = latest.max_timestamp
      LEFT JOIN users u ON d.user_id = u.id
      LEFT JOIN (
          SELECT 
              id, 
              driver_id, 
              client_name,
              -- Subconsulta para pegar apenas a entrega mais recente em trânsito por motorista
              ROW_NUMBER() OVER(PARTITION BY driver_id ORDER BY created_at DESC) as rn 
          FROM deliveries 
          WHERE status = 'IN_TRANSIT'
      ) del ON d.id = del.driver_id AND del.rn = 1
      WHERE d.company_id = ?
        AND tp.latitude IS NOT NULL
        AND tp.longitude IS NOT NULL
      ORDER BY tp.timestamp DESC
    `, [req.user.company_id, req.user.company_id]);

    const vehicleIdsToLookup = new Set();
    const nowIso = new Date().toISOString();

    for (const row of rows) {
      const driverKey = String(row.driver_id);
      const candidateVehicleId = row.vehicle_id != null ? String(row.vehicle_id) : null;
      const mapping = driverVehicleMap.get(driverKey);

      if (mapping && (!mapping.companyId || mapping.companyId === String(req.user.company_id))) {
        row.vehicle_id = mapping.vehicleId ?? candidateVehicleId ?? null;
        row.vehicle_label = mapping.vehicleLabel ?? null;

        if (!row.vehicle_label && row.vehicle_id) {
          vehicleIdsToLookup.add(String(row.vehicle_id));
        }

        if (!mapping.vehicleLabel && candidateVehicleId && mapping.vehicleId !== candidateVehicleId) {
          driverVehicleMap.set(driverKey, { ...mapping, vehicleId: candidateVehicleId, updatedAt: nowIso });
        }
      } else {
        row.vehicle_label = null;
        if (candidateVehicleId) {
          row.vehicle_id = candidateVehicleId;
          vehicleIdsToLookup.add(candidateVehicleId);
          driverVehicleMap.set(driverKey, {
            vehicleId: candidateVehicleId,
            vehicleLabel: null,
            companyId: req.user.company_id ? String(req.user.company_id) : null,
            updatedAt: nowIso,
          });
        } else {
          row.vehicle_id = null;
        }
      }
    }

    if (vehicleIdsToLookup.size > 0) {
      try {
        const [vehicleRows] = await pool.query(
          'SELECT id, plate, model, brand FROM vehicles WHERE id IN (?)',
          [Array.from(vehicleIdsToLookup)]
        );
        const labelMap = new Map();
        if (Array.isArray(vehicleRows)) {
          for (const vehicle of vehicleRows) {
            const parts = [];
            if (vehicle.plate) parts.push(String(vehicle.plate).toUpperCase());
            if (vehicle.model) parts.push(String(vehicle.model));
            if (parts.length === 0 && vehicle.brand) parts.push(String(vehicle.brand));
            const label = parts.length ? parts.join(' - ') : `Veiculo ${vehicle.id}`;
            labelMap.set(String(vehicle.id), label);
          }
        }

        for (const row of rows) {
          if (row.vehicle_id) {
            const label = labelMap.get(String(row.vehicle_id));
            if (label) {
              row.vehicle_label = label;
              const mapping = driverVehicleMap.get(String(row.driver_id));
              if (mapping) {
                driverVehicleMap.set(String(row.driver_id), { ...mapping, vehicleLabel: label });
              }
            }
          }
        }
      } catch (error) {
        console.warn('[Tracking] Falha ao buscar dados dos veiculos:', error.message);
      }
    }

    console.log(`[Tracking] Consulta executada. ${rows.length} localizações encontradas.`);
    if (rows.length > 0) {
        console.log('[Tracking] Exemplo de dados retornados:', JSON.stringify(rows[0], null, 2));
    }
    res.json({
      success: true,
      data: rows.map(row => ({ ...row, activity_status: row.activity_status }))
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
    const { status: frontendStatus } = req.body;
    const companyId = req.user.company_id;

    console.log(`[Tracking] Recebida atualização de status para driver ${driverId} com status: ${frontendStatus}`);

    const statusMap = {
      online: 'active',
      offline: 'inactive',
      idle: 'inactive',
      busy: 'active',
    };

    const dbStatus = statusMap[frontendStatus];

    if (!dbStatus) {
      console.error(`[Tracking] Status inválido recebido: ${frontendStatus}`);
      return res.status(400).json({ error: `Status inválido: ${frontendStatus}` });
    }

    let driverIdToUpdate = driverId;
    const [driverRows] = await pool.query(
      'SELECT * FROM drivers WHERE id = ? AND company_id = ?',
      [driverId, companyId]
    );

    if (driverRows.length === 0) {
      // Tenta encontrar o motorista pelo user_id do token se não encontrar pelo driverId
      const [rowsByUser] = await pool.query(
        'SELECT * FROM drivers WHERE user_id = ? AND company_id = ?',
        [req.user.id, companyId] // <-- CORRIGIDO: de req.user.user_id para req.user.id
      );

      if (rowsByUser.length === 0) {
        console.warn('[Tracking] Driver não encontrado para atualização de status', { driverId, userId: req.user.id }); // <-- CORRIGIDO
        return res.status(404).json({ error: 'Motorista não encontrado' });
      }

      driverIdToUpdate = rowsByUser[0].id;
    }

    await pool.query(
      'UPDATE drivers SET status = ?, last_status_update = NOW() WHERE id = ?',
      [dbStatus, driverIdToUpdate]
    );
    console.log(`[Tracking] Status do driver ${driverIdToUpdate} atualizado para '${dbStatus}' no banco de dados.`);

    broadcastToCompany(companyId, {
      type: 'driver_status',
      driver_id: driverIdToUpdate,
      status: dbStatus,
      timestamp: new Date().toISOString()
    });

    res.json({ success: true, message: 'Status atualizado com sucesso' });

  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: error.message });
  } 
}); 


if (require.main === module) {
  const PORT = Number(process.env.TRACKING_SERVICE_PORT || process.env.TRACKING_PORT || process.env.PORT || 3005);
  server.listen(PORT, () => console.log(`Tracking Service rodando na porta ${PORT}`));
}

module.exports = app; 
