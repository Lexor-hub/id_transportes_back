const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createWorker } = require('tesseract.js');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Receipts OCR',
    version: '1.0.0',
    description: 'API para upload e processamento OCR de canhotos'
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

// Configurar multer para upload de arquivos
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas arquivos JPG, PNG e PDF são permitidos'));
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
 * /api/receipts/upload:
 *   post:
 *     summary: Upload de canhoto
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               delivery_id:
 *                 type: string
 *               driver_id:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Canhoto enviado com sucesso
 */
app.post('/api/receipts/upload', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), upload.single('file'), async (req, res) => {
  try {
    // Aceitar tanto snake_case quanto camelCase
    const delivery_id = req.body.delivery_id || req.body.deliveryId;
    const driver_id = req.body.driver_id || req.body.driverId;
    const notes = req.body.notes;
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'Arquivo não fornecido' });
    }

    if (!delivery_id || !driver_id) {
      return res.status(400).json({ error: 'delivery_id/deliveryId e driver_id/driverId são obrigatórios' });
    }

    // Verificar se a entrega existe e pertence ao motorista
    const [deliveryRows] = await pool.query(
      'SELECT * FROM delivery_notes WHERE id = ? AND driver_id = ? AND company_id = ?',
      [delivery_id, driver_id, req.user.company_id]
    );

    if (deliveryRows.length === 0) {
      return res.status(404).json({ error: 'Entrega não encontrada' });
    }

    // Inserir registro do canhoto
    const [result] = await pool.query(`
      INSERT INTO delivery_receipts (delivery_note_id, captured_by_user_id, company_id, image_url, photo_datetime)
      VALUES (?, ?, ?, ?, NOW())
    `, [delivery_id, driver_id, req.user.company_id, file.path]);

    const receiptId = result.insertId;

    res.status(201).json({
      success: true,
      data: {
        id: receiptId,
        filename: file.originalname,
        url: `/api/receipts/${receiptId}/download`,
        processed: false,
        status: 'PENDING'
      }
    });

  } catch (error) {
    console.error('Erro no upload:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/receipts/{id}/process-ocr:
 *   post:
 *     summary: Processar OCR do canhoto
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
 *         description: OCR processado com sucesso
 */
app.post('/api/receipts/:id/process-ocr', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const receiptId = req.params.id;

    // Buscar informações do canhoto
    const [receiptRows] = await pool.query(
      'SELECT * FROM delivery_receipts WHERE id = ? AND company_id = ?',
      [receiptId, req.user.company_id]
    );

    if (receiptRows.length === 0) {
      return res.status(404).json({ error: 'Canhoto não encontrado' });
    }

    const receipt = receiptRows[0];

    // Verificar se o arquivo existe
    if (!fs.existsSync(receipt.file_path)) {
      return res.status(404).json({ error: 'Arquivo não encontrado' });
    }

    // Processar OCR
    const worker = await createWorker('por');
    const { data: { text } } = await worker.recognize(receipt.file_path);
    await worker.terminate();

    // Extrair dados estruturados do texto
    const ocrData = extractStructuredData(text);

    // Atualizar status do canhoto
    await pool.query(
      'UPDATE delivery_receipts SET ocr_data = ?, status = ?, processed_at = NOW() WHERE id = ?',
      [JSON.stringify(ocrData), 'PROCESSED', receiptId]
    );

    res.json({
      success: true,
      data: {
        ocr_data: ocrData,
        raw_text: text
      }
    });

  } catch (error) {
    console.error('Erro no processamento OCR:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/receipts/{id}/validate:
 *   put:
 *     summary: Validar dados OCR
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
 *               ocr_data:
 *                 type: object
 *               validated:
 *                 type: boolean
 *               corrections:
 *                 type: object
 *     responses:
 *       200:
 *         description: Dados validados com sucesso
 */
app.put('/api/receipts/:id/validate', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const receiptId = req.params.id;
    const { ocr_data, validated, corrections } = req.body;

    // Verificar se o canhoto existe
    const [receiptRows] = await pool.query(
      'SELECT * FROM delivery_receipts WHERE id = ? AND company_id = ?',
      [receiptId, req.user.company_id]
    );

    if (receiptRows.length === 0) {
      return res.status(404).json({ error: 'Canhoto não encontrado' });
    }

    // Atualizar dados validados
    await pool.query(
      'UPDATE delivery_receipts SET validated_ocr_data = ?, corrections = ?, validated = ?, validated_at = NOW() WHERE id = ?',
      [JSON.stringify(ocr_data), JSON.stringify(corrections), validated, receiptId]
    );

    res.json({
      success: true,
      message: 'Dados validados com sucesso'
    });

  } catch (error) {
    console.error('Erro na validação:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * @swagger
 * /api/receipts:
 *   get:
 *     summary: Listar canhotos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de canhotos
 */
app.get('/api/receipts', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const { delivery_id, driver_id, status } = req.query;
    let query = `
      SELECT r.*, d.nf_number, d.client_name, u.full_name as driver_name
      FROM delivery_receipts r
      LEFT JOIN delivery_notes d ON r.delivery_id = d.id
      LEFT JOIN users u ON r.driver_id = u.id
      WHERE r.company_id = ?
    `;
    const params = [req.user.company_id];

    if (delivery_id) {
      query += ' AND r.delivery_id = ?';
      params.push(delivery_id);
    }

    if (driver_id) {
      query += ' AND r.driver_id = ?';
      params.push(driver_id);
    }

    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC';

    const [rows] = await pool.query(query, params);

    res.json({
      success: true,
      data: rows
    });

  } catch (error) {
    console.error('Erro ao listar canhotos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Função para extrair dados estruturados do texto OCR
function extractStructuredData(text) {
  const data = {
    nf_number: '',
    client_name: '',
    address: '',
    value: 0,
    items: []
  };

  // Extrair número da NF
  const nfMatch = text.match(/NF[:\s]*(\d+)/i);
  if (nfMatch) {
    data.nf_number = nfMatch[1];
  }

  // Extrair valor total
  const valueMatch = text.match(/total[:\s]*R?\$?\s*([\d,]+\.?\d*)/i);
  if (valueMatch) {
    data.value = parseFloat(valueMatch[1].replace(',', '.'));
  }

  // Extrair nome do cliente (simplificado)
  const lines = text.split('\n');
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    const line = lines[i].trim();
    if (line.length > 3 && !line.match(/^\d/) && !line.match(/total/i)) {
      data.client_name = line;
      break;
    }
  }

  return data;
}

if (require.main === module) {
  app.listen(3004, () => console.log('Receipts OCR Service rodando na porta 3004'));
}

module.exports = app; 