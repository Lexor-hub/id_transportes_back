const express = require('express');
const pool = require('../../shared/db');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const Tesseract = require('tesseract.js');
const app = express();
app.use(express.json());

const cors = require('cors');

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Receipts/OCR',
    version: '1.0.0',
    description: 'Documentação da API de canhotos e OCR'
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
 * /api/receipts/upload:
 *   post:
 *     summary: Upload de canhoto (imagem)
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *               delivery_note_id:
 *                 type: string
 *               captured_by_user_id:
 *                 type: string
 *     responses:
 *       201:
 *         description: Canhoto enviado
 */
// Configuração do multer para upload de arquivos
const uploadDir = path.join(__dirname, '../../uploads/receipts');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const filename = `${Date.now()}-${Math.round(Math.random()*1E9)}${ext}`;
    cb(null, filename);
  }
});
const upload = multer({ 
  storage,
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Apenas arquivos de imagem são permitidos'));
    }
    cb(null, true);
  },
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB
});

// Upload de canhoto (arquivo real)
app.post('/api/receipts/upload', upload.single('file'), async (req, res) => {
  const { delivery_note_id, captured_by_user_id } = req.body;
  if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });
  const image_url = path.relative(process.cwd(), req.file.path).replace(/\\/g, '/');
  try {
    await pool.query(
      'INSERT INTO delivery_receipts (delivery_note_id, image_url, captured_by_user_id) VALUES (?, ?, ?)',
      [delivery_note_id, image_url, captured_by_user_id]
    );
    res.status(201).json({ message: 'Canhoto enviado', image_url });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listar canhotos
app.get('/api/receipts', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM delivery_receipts');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Processar OCR real e extrair campos obrigatórios
app.post('/api/receipts/:id/process-ocr', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM delivery_receipts WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Canhoto não encontrado' });
    const receipt = rows[0];
    const imagePath = require('path').resolve(receipt.image_url);
    const { data: { text } } = await Tesseract.recognize(imagePath, 'por');
    // Regex para extrair campos
    const nome = (text.match(/nome[:\s]*([\w\s]+)/i) || [])[1] || null;
    const cpf = (text.match(/cpf[:\s-]*([0-9\.\-]+)/i) || [])[1] || null;
    const dataEntrega = (text.match(/data[:\s]*([0-9]{2}\/[0-9]{2}\/[0-9]{4})/i) || [])[1] || null;
    const hora = (text.match(/hora[:\s]*([0-9]{2}:[0-9]{2})/i) || [])[1] || null;
    const ocrData = { text, nome, cpf, dataEntrega, hora };
    await pool.query(
      'UPDATE delivery_receipts SET ocr_extracted_data = ? WHERE id = ?',
      [JSON.stringify(ocrData), req.params.id]
    );
    res.json({ message: 'OCR realizado com sucesso', ocrData });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhes do canhoto
app.get('/api/receipts/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM delivery_receipts WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Canhoto não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Canhoto de uma entrega
app.get('/api/deliveries/:deliveryId/receipt', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM delivery_receipts WHERE delivery_note_id = ?', [req.params.deliveryId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Canhoto não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(3004, () => console.log('Receipts/OCR Service rodando na porta 3004'));
}
module.exports = app; 