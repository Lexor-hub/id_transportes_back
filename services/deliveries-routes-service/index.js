const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Deliveries & Routes',
    version: '1.0.0',
    description: 'API para gestão de entregas, rotas e ocorrências'
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

// Configurar multer para upload de fotos de ocorrências
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads/occurrences');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'occurrence-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas arquivos JPG e PNG são permitidos'));
    }
  }
});

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
 * /api/deliveries/{id}/occurrence:
 *   post:
 *     summary: Registrar ocorrência na entrega
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [reentrega, recusa, avaria]
 *               description:
 *                 type: string
 *               photo:
 *                 type: string
 *                 format: binary
 *               latitude:
 *                 type: number
 *               longitude:
 *                 type: number
 *     responses:
 *       201:
 *         description: Ocorrência registrada com sucesso
 */
app.post('/api/deliveries/:id/occurrence', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), upload.single('photo'), async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { type, description, latitude, longitude } = req.body;
    const photo = req.file;

    // Verificar se a entrega existe e pertence à empresa
    const [deliveryRows] = await pool.query(
      'SELECT * FROM delivery_notes WHERE id = ? AND company_id = ?',
      [deliveryId, req.user.company_id]
    );

    if (deliveryRows.length === 0) {
      return res.status(404).json({ error: 'Entrega não encontrada' });
    }

    // Inserir ocorrência
    const [result] = await pool.query(`
      INSERT INTO delivery_occurrences (delivery_id, company_id, driver_id, type, description, photo_url, latitude, longitude, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      deliveryId,
      req.user.company_id,
      req.user.id,
      type,
      description,
      photo ? photo.path : null,
      latitude || null,
      longitude || null,
      req.user.id
    ]);

    const occurrenceId = result.insertId;

    // Atualizar status da entrega se necessário
    if (type === 'recusa') {
      await pool.query(
        'UPDATE delivery_notes SET status = ? WHERE id = ?',
        ['REFUSED', deliveryId]
      );
    }

    res.status(201).json({
      success: true,
      data: {
        id: occurrenceId,
        delivery_id: deliveryId,
        type,
        description,
        photo_url: photo ? `/api/occurrences/${occurrenceId}/photo` : null,
        created_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('Erro ao registrar ocorrência:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/occurrences:
 *   get:
 *     summary: Listar ocorrências
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
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
 *       - in: query
 *         name: driver_id
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Lista de ocorrências
 */
app.get('/api/occurrences', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const { type, start_date, end_date, driver_id } = req.query;
    
    let query = `
      SELECT 
        o.*,
        d.nf_number,
        d.client_name,
        d.client_address,
        u.full_name as driver_name,
        u2.full_name as created_by_name
      FROM delivery_occurrences o
      LEFT JOIN delivery_notes d ON o.delivery_id = d.id
      LEFT JOIN users u ON o.driver_id = u.id
      LEFT JOIN users u2 ON o.created_by = u2.id
      WHERE o.company_id = ?
    `;
    const params = [req.user.company_id];

    if (type) {
      query += ' AND o.type = ?';
      params.push(type);
    }

    if (start_date) {
      query += ' AND DATE(o.created_at) >= ?';
      params.push(start_date);
    }

    if (end_date) {
      query += ' AND DATE(o.created_at) <= ?';
      params.push(end_date);
    }

    if (driver_id) {
      query += ' AND o.driver_id = ?';
      params.push(driver_id);
    }

    query += ' ORDER BY o.created_at DESC';

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erro ao listar ocorrências:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/occurrences/{id}:
 *   get:
 *     summary: Obter detalhes de uma ocorrência
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes da ocorrência
 */
app.get('/api/occurrences/:id', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const occurrenceId = req.params.id;

    const [rows] = await pool.query(`
      SELECT 
        o.*,
        d.nf_number,
        d.client_name,
        d.client_address,
        u.full_name as driver_name,
        u2.full_name as created_by_name
      FROM delivery_occurrences o
      LEFT JOIN delivery_notes d ON o.delivery_id = d.id
      LEFT JOIN users u ON o.driver_id = u.id
      LEFT JOIN users u2 ON o.created_by = u2.id
      WHERE o.id = ? AND o.company_id = ?
    `, [occurrenceId, req.user.company_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }

    res.json({
      success: true,
      data: rows[0]
    });

  } catch (error) {
    console.error('Erro ao obter ocorrência:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/occurrences/{id}/photo:
 *   get:
 *     summary: Obter foto da ocorrência
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Foto da ocorrência
 */
app.get('/api/occurrences/:id/photo', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const occurrenceId = req.params.id;

    const [rows] = await pool.query(
      'SELECT photo_url FROM delivery_occurrences WHERE id = ? AND company_id = ?',
      [occurrenceId, req.user.company_id]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Ocorrência não encontrada' });
    }

    const occurrence = rows[0];
    
    if (!occurrence.photo_url) {
      return res.status(404).json({ error: 'Foto não encontrada' });
    }

    if (!fs.existsSync(occurrence.photo_url)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    res.sendFile(path.resolve(occurrence.photo_url));

  } catch (error) {
    console.error('Erro ao obter foto:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/deliveries:
 *   get:
 *     summary: Listar entregas
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de entregas
 */
app.get('/api/deliveries', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const { status, driver_id, client_id } = req.query;
    
    let query = `
      SELECT 
        d.*,
        u.full_name as driver_name,
        c.name as client_name,
        c.address as client_address
      FROM delivery_notes d
      LEFT JOIN users u ON d.driver_id = u.id
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.company_id = ?
    `;
    const params = [req.user.company_id];

    if (status) {
      query += ' AND d.status = ?';
      params.push(status);
    }

    if (driver_id) {
      query += ' AND d.driver_id = ?';
      params.push(driver_id);
    }

    if (client_id) {
      query += ' AND d.client_id = ?';
      params.push(client_id);
    }

    query += ' ORDER BY d.created_at DESC';

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erro ao listar entregas:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/deliveries/{id}:
 *   get:
 *     summary: Obter detalhes de uma entrega
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Detalhes da entrega
 */
app.get('/api/deliveries/:id', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const deliveryId = req.params.id;

    const [rows] = await pool.query(`
      SELECT 
        d.*,
        u.full_name as driver_name,
        c.name as client_name,
        c.address as client_address,
        c.phone as client_phone
      FROM delivery_notes d
      LEFT JOIN users u ON d.driver_id = u.id
      LEFT JOIN clients c ON d.client_id = c.id
      WHERE d.id = ? AND d.company_id = ?
    `, [deliveryId, req.user.company_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Entrega não encontrada' });
    }

    // Buscar ocorrências da entrega
    const [occurrences] = await pool.query(
      'SELECT * FROM delivery_occurrences WHERE delivery_id = ? ORDER BY created_at DESC',
      [deliveryId]
    );

    const delivery = rows[0];
    delivery.occurrences = occurrences;

    res.json({
      success: true,
      data: delivery
    });

  } catch (error) {
    console.error('Erro ao obter entrega:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/deliveries/{id}/status:
 *   put:
 *     summary: Atualizar status da entrega
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
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
 *                 enum: [PENDING, IN_TRANSIT, DELIVERED, CANCELLED, REFUSED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Status atualizado com sucesso
 */
app.put('/api/deliveries/:id/status', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { status, notes } = req.body;

    // Verificar se a entrega existe e pertence à empresa
    const [deliveryRows] = await pool.query(
      'SELECT * FROM delivery_notes WHERE id = ? AND company_id = ?',
      [deliveryId, req.user.company_id]
    );

    if (deliveryRows.length === 0) {
      return res.status(404).json({ error: 'Entrega não encontrada' });
    }

    // Atualizar status
    await pool.query(
      'UPDATE delivery_notes SET status = ?, notes = ?, updated_at = NOW() WHERE id = ?',
      [status, notes, deliveryId]
    );

    res.json({
      success: true,
      message: 'Status atualizado com sucesso'
    });

  } catch (error) {
    console.error('Erro ao atualizar status:', error);
    res.status(500).json({ error: error.message });
  }
});

if (require.main === module) {
  app.listen(3003, () => console.log('Deliveries & Routes Service rodando na porta 3003'));
}

module.exports = app; 