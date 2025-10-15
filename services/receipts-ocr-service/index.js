﻿
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const envCandidates = [
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '.env')
];

let envLoaded = false;
envCandidates.forEach((envPath) => {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: true });
    envLoaded = true;
  }
});

if (!envLoaded) {
  dotenv.config({ override: true });
}

const express = require('express');
const multer = require('multer');
const { createWorker } = require('tesseract.js');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const {
  ensureGoogleCredentialsFile,
  getServiceAccountProjectId,
} = require('../../shared/googleCredentials');

const RECEIPTS_PUBLIC_BASE_URL =
  process.env.RECEIPTS_PUBLIC_BASE_URL ||
  process.env.RECEIPTS_SERVICE_PUBLIC_URL ||
  process.env.BACKEND_PUBLIC_BASE_URL ||
  process.env.API_PUBLIC_BASE_URL ||
  '';

const buildReceiptViewUrl = (storagePath) => {
  if (!storagePath) return null;
  const base = RECEIPTS_PUBLIC_BASE_URL || 'http://localhost:3004';
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  return `${normalizedBase}/api/receipts/view?path=${encodeURIComponent(storagePath)}`;
};

const vision = require('@google-cloud/vision');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const { Storage } = require('@google-cloud/storage');

// Centralizar a inicializa��o dos clientes do Google Cloud
ensureGoogleCredentialsFile();
const serviceAccountProjectId = getServiceAccountProjectId();
if (!process.env.DOCUMENT_AI_PROJECT_ID && serviceAccountProjectId) {
  process.env.DOCUMENT_AI_PROJECT_ID = serviceAccountProjectId;
}

let hasGoogleCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
let visionClient = null;
let documentAIClient = null;
let storage = null;
let bucket = null;

const isDocumentAIReady = () => (
  documentAIClient &&
  typeof documentAIClient.processDocument === 'function' &&
  !!OCR_CONFIG.documentAIProjectId &&
  !!OCR_CONFIG.documentAIProcessorId
);

const describeDocumentAIConfig = () => ({
  projectId: OCR_CONFIG.documentAIProjectId || null,
  processorId: OCR_CONFIG.documentAIProcessorId || null,
  location: OCR_CONFIG.documentAILocation || null,
  hasClient: !!(documentAIClient && typeof documentAIClient.processDocument === 'function'),
  credentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS || null,
});



if (hasGoogleCredentials) {
  try {
    const resolveCredentialsPath = () => {
      const credentialEnv = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!credentialEnv) return null;

      if (path.isAbsolute(credentialEnv)) {
        return fs.existsSync(credentialEnv) ? credentialEnv : null;
      }

      const backendRoot = path.resolve(__dirname, '..', '..');
      const resolved = path.resolve(backendRoot, credentialEnv.replace(/^\.\/?/, ''));
      return fs.existsSync(resolved) ? resolved : null;
    };

    const keyFilename = resolveCredentialsPath();

    if (keyFilename) {
      visionClient = new vision.ImageAnnotatorClient({ keyFilename });
      documentAIClient = new DocumentProcessorServiceClient({ keyFilename });
      storage = new Storage({ keyFilename });

      const bucketName = process.env.GCLOUD_BUCKET || process.env.GCS_BUCKET;
      if (bucketName) {
        bucket = storage.bucket(bucketName);
        console.log('? [Receipts] Google Cloud Storage configurado com sucesso.');
      } else {
        console.warn('?? [Receipts] GCS_BUCKET_NAME n�o definido. Uploads ser�o locais.');
      }
    } else {
      throw new Error('Caminho das credenciais do Google n�o encontrado.');
    }
  } catch (error) {
    console.warn('?? Erro ao configurar Google Cloud Services no Receipts Service:', error.message);
    console.warn('?? Usando armazenamento local como fallback.');
    hasGoogleCredentials = false; // For�a o fallback
  }
} else {
  console.warn('?? [Receipts] Google Cloud Storage n�o configurado. Usando armazenamento local.');
}


// Configura��es de OCR
const normalizeEnv = (value, fallback) => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : fallback;
  }
  return value ?? fallback;
};

const flagToBoolean = (value, fallback = false) => {
  if (typeof value === 'string') {
    return ['true', '1', 'yes', 'on'].includes(value.trim().toLowerCase());
  }
  if (value === undefined || value === null) {
    return fallback;
  }
  return Boolean(value);
};

const OCR_CONFIG = {
  defaultEngine: normalizeEnv(process.env.OCR_DEFAULT_ENGINE, 'vision'),
  enableDocumentAI: flagToBoolean(process.env.OCR_ENABLE_DOCUMENT_AI),
  documentAIProcessorId: normalizeEnv(process.env.DOCUMENT_AI_PROCESSOR_ID, 'processor-id'),
  documentAILocation: normalizeEnv(process.env.DOCUMENT_AI_LOCATION, 'us'),
  documentAIProjectId: normalizeEnv(process.env.DOCUMENT_AI_PROJECT_ID, normalizeEnv(process.env.GCLOUD_PROJECT_ID)),
};

console.log('[Receipts] Configura��es de OCR e Storage carregadas:', {
  defaultEngine: OCR_CONFIG.defaultEngine,
  enableDocumentAI: OCR_CONFIG.enableDocumentAI,
  documentAILocation: OCR_CONFIG.documentAILocation,
  documentAIProjectId: OCR_CONFIG.documentAIProjectId,
  documentAIProcessorId: OCR_CONFIG.documentAIProcessorId,
  googleCredentialsPath: process.env.GOOGLE_APPLICATION_CREDENTIALS,
  gcloudProjectId: process.env.GCLOUD_PROJECT_ID,
  gcloudBucket: process.env.GCLOUD_BUCKET,
});



// FunÃƒÂ§ÃƒÂ£o para enviar arquivo ao Google Cloud Storage
async function uploadToGCS(file, folder = 'receipts') {
  // Se o bucket não estiver configurado ou não houver credenciais, salva localmente
  if (!bucket || !hasGoogleCredentials) {
    console.warn(`[Receipts] GCS não configurado. Salvando arquivo localmente na pasta '${folder}'.`);
    // Usa o diretório do serviço de entregas para centralizar os uploads
    const uploadDir = path.resolve(__dirname, `../deliveries-routes-service/uploads/${folder}`);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname || '.jpg')}`;
    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, file.buffer);
    // A URL deve ser relativa à porta 3003, que é onde a pasta está exposta
    const localUrl = `http://localhost:3003/uploads/${folder}/${uniqueName}`;
    return { publicUrl: localUrl, gcsPath: filePath };
  }

  return new Promise((resolve, reject) => {
    if (!file) return resolve(null);

    const uniqueName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    const blob = bucket.file(uniqueName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype
    });

    blobStream.on('error', err => {
      console.error('Falha ao enviar arquivo ao GCS (uniform bucket):', {
        code: err.code,
        message: err.message,
        reason: err.errors && err.errors[0] ? err.errors[0].reason : undefined,
      });
      reject(err);
    });
    blobStream.on('finish', async () => {
      const backendUrl = buildReceiptViewUrl(blob.name);
      console.log(
        '[GCS] Arquivo salvo.',
        {
          storagePath: blob.name,
          publicBase: RECEIPTS_PUBLIC_BASE_URL || 'http://localhost:3004'
        }
      );
      resolve({ publicUrl: backendUrl, gcsPath: blob.name });
    });

    blobStream.end(file.buffer);
  });
}

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
// Configuracao CORS alinhada com os outros servicos HTTP
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

const isOriginAllowed = (origin) => {
  if (!origin) return true;
  return whitelist.some((pattern) =>
    pattern instanceof RegExp ? pattern.test(origin) : pattern === origin
  );
};

const corsOptions = {
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.error(`[Receipts CORS] Origin '${origin}' not allowed.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

const ensureCorsHeaders = (req, res) => {
  const origin = req.headers?.origin;
  if (!origin || !isOriginAllowed(origin)) {
    return;
  }
  res.header('Access-Control-Allow-Origin', origin);
  res.header('Vary', 'Origin');
  res.header('Access-Control-Allow-Credentials', 'true');
};

app.use(cors(corsOptions));
app.use((req, res, next) => {
  ensureCorsHeaders(req, res);
  if (req.method === 'OPTIONS') {
    const requestHeaders = req.headers['access-control-request-headers'];
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    if (requestHeaders) {
      res.header('Access-Control-Allow-Headers', requestHeaders);
    } else {
      res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, Accept');
    }
    return res.sendStatus(204);
  }
  next();
});
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Configurar multer para upload de arquivos (usando memoryStorage para GCS)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|doc|docx/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype) || 
                    file.mimetype === 'application/msword' || 
                    file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Apenas arquivos JPG, PNG, PDF e Word (DOC, DOCX) sÃƒÂ£o permitidos'));
    }
  }
});

// FunÃƒÂ§ÃƒÂ£o para garantir que temos um diretÃƒÂ³rio local para arquivos temporÃƒÂ¡rios
const ensureLocalDir = () => {
  const uploadDir = path.join(__dirname, 'temp');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }
  return uploadDir;
};

// Middleware de autenticaÃƒÂ§ÃƒÂ£o
function authorize(roles = []) {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Token nÃƒÂ£o fornecido' });
    const token = auth.split(' ')[1];
    try {
      const decoded = jwt.verify(token, "fda76ff877a92f9a86e7831fad372e2d9e777419e155aab4f5b18b37d280d05a");
      if (roles.length && !roles.includes(decoded.user_type)) {
        return res.status(403).json({ error: 'Acesso negado' });
      }
      req.user = decoded;
      next();
    } catch (err) {
      res.status(401).json({ error: 'Token invÃƒÂ¡lido' });
    }
  };
}

async function serveReceiptFile(req, res, rawParam) {
  try {
    ensureCorsHeaders(req, res);
    let gcsPath = rawParam;
    if (typeof gcsPath === 'string' && gcsPath.length > 0) {
      try {
        gcsPath = decodeURIComponent(gcsPath);
      } catch (decodeError) {
        console.warn('Nao foi possivel decodificar o caminho do recibo, usando valor bruto.', decodeError.message);
      }
    }

    if (!gcsPath) {
      return res.status(400).send('Caminho do arquivo nao informado.');
    }

    if (!bucket || !hasGoogleCredentials) {
      const localPath = gcsPath;
      if (fs.existsSync(localPath)) {
        return res.sendFile(localPath);
      }
      return res.status(404).send('Arquivo local nao encontrado.');
    }

    const file = bucket.file(gcsPath);
    const [exists] = await file.exists();

    if (!exists) {
      return res.status(404).send('Arquivo nao encontrado no Google Cloud Storage.');
    }

    file.createReadStream()
      .on('error', (err) => {
        console.error('Erro ao fazer stream do arquivo GCS:', err);
        res.status(500).send('Erro ao ler o arquivo.');
      })
      .pipe(res);
  } catch (error) {
    console.error('Erro ao servir arquivo do GCS:', error);
    res.status(500).send('Erro interno do servidor.');
  }
}

app.get('/api/receipts/view', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  const rawParam = typeof req.query?.path === 'string' ? req.query.path : null;
  await serveReceiptFile(req, res, rawParam);
});
app.get(/^\/api\/receipts\/view\/(.+)$/, authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  const legacyParam = req.params[0] || null;
  await serveReceiptFile(req, res, legacyParam);
});

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
      return res.status(400).json({ error: 'Arquivo nÃƒÂ£o fornecido' });
    }

    if (!delivery_id || !driver_id) {
      return res.status(400).json({ error: 'delivery_id/deliveryId e driver_id/driverId sÃƒÂ£o obrigatÃƒÂ³rios' });
    }

    // Verificar se a entrega existe e pertence ao motorista
    const [deliveryRows] = await pool.query(
      'SELECT * FROM delivery_notes WHERE id = ? AND company_id = ?',
      [delivery_id, req.user.company_id]);

    if (deliveryRows.length === 0) {
      return res.status(404).json({ error: 'Entrega n�o encontrada' });
    }

    // Upload para o Google Cloud Storage
    const uploadResult = await uploadToGCS(file, 'receipts');
    
    if (!uploadResult || !uploadResult.publicUrl) {
      return res.status(500).json({ error: 'Falha ao fazer upload do arquivo para o Cloud Storage' });
    }
    
    // CORRE��O: Usa INSERT ... ON DUPLICATE KEY UPDATE para evitar o erro de entrada duplicada.
    // Se um canhoto para a entrega j� existe, ele atualiza a imagem e reseta o status.
    // Se n�o existe, ele insere um novo.
    const sql = `
      INSERT INTO delivery_receipts
        (delivery_note_id, driver_id, company_id, image_url, gcs_path, photo_datetime, status, notes)
      VALUES
        (?, ?, ?, ?, ?, NOW(), 'PENDING', ?)
      ON DUPLICATE KEY UPDATE
        image_url = VALUES(image_url),
        gcs_path = VALUES(gcs_path), 
        driver_id = VALUES(driver_id),
        photo_datetime = NOW(),
        status = 'PENDING',
        notes = VALUES(notes)`;
    const [result] = await pool.query(sql, [delivery_id, driver_id, req.user.company_id, uploadResult.publicUrl, uploadResult.gcsPath, notes]);

    const receiptId = result.insertId;

    res.status(201).json({
      success: true,
      data: {
        id: receiptId,
        filename: file.originalname,
        url: uploadResult.publicUrl,
        gcs_path: uploadResult.gcsPath,
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
app.post('/api/receipts/:id/process-ocr', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), upload.single('file'), async (req, res) => {
  try {
    const receiptId = req.params.id;
    const { engine = 'vision' } = req.query; 
    // engine pode ser "vision", "tesseract" ou "documentai"

    // Buscar informaÃƒÂ§ÃƒÂµes do canhoto
    const [receiptRows] = await pool.query(
      'SELECT * FROM delivery_receipts WHERE id = ? AND company_id = ?',
      [receiptId, req.user.company_id])

    if (receiptRows.length === 0) {
      return res.status(404).json({ error: 'Canhoto n�o encontrado' });
    }

    const receipt = receiptRows[0];
    let fileContent;
    let fileExt;

    // Se um novo arquivo foi enviado, faz upload para o GCS
    if (req.file) {
      const uploadResult = await uploadToGCS(req.file, 'receipts');
      
      if (!uploadResult || !uploadResult.publicUrl) {
        return res.status(500).json({ error: 'Falha ao fazer upload do arquivo para o Cloud Storage' });
      }
      
      // Atualiza o registro com a nova URL do GCS
      await pool.query(
        'UPDATE delivery_receipts SET image_url = ?, gcs_path = ? WHERE id = ?',
        [uploadResult.publicUrl, uploadResult.gcsPath, receiptId])
      
      receipt.image_url = uploadResult.publicUrl;
      receipt.gcs_path = uploadResult.gcsPath;
      
      // Usa o buffer do arquivo enviado diretamente
      fileContent = req.file.buffer;
      fileExt = path.extname(req.file.originalname).toLowerCase();
    } else {
      // Verifica se o arquivo estÃƒÂ¡ no GCS ou localmente
      if (receipt.gcs_path) {
        // Baixa o arquivo do GCS para processamento
        console.log(' Baixando arquivo do Google Cloud Storage:', receipt.gcs_path);
        try {
          const tempDir = ensureLocalDir();
          const tempFilePath = path.join(tempDir, path.basename(receipt.gcs_path));
          
          // Baixa o arquivo do GCS
          await bucket.file(receipt.gcs_path).download({ destination: tempFilePath });
          fileContent = fs.readFileSync(tempFilePath);
          fileExt = path.extname(receipt.gcs_path).toLowerCase();
          
          // Remove o arquivo temporÃƒÂ¡rio apÃƒÂ³s uso
          fs.unlinkSync(tempFilePath);
        } catch (downloadError) {
          console.error(' Erro ao baixar arquivo do GCS:', downloadError);
          return res.status(404).json({ error: 'N�o foi poss�vel acessar o arquivo no Cloud Storage' });
        }
      } else if (fs.existsSync(receipt.image_url)) {
        // Arquivo local (compatibilidade com versÃƒÂ£o anterior)
        fileContent = fs.readFileSync(receipt.image_url);
        fileExt = path.extname(receipt.image_url).toLowerCase();
      } else {
        return res.status(404).json({ error: 'Arquivo n�o encontrado' });
      }
    }

    let text = '';
    
    // Processamento baseado no tipo de arquivo
    if (fileExt === '.doc' || fileExt === '.docx' || fileExt === '.pdf') {
      console.log(` Processando documento ${fileExt} usando Google Cloud Document AI`);
      try {
        // Usando Document Text Detection para documentos
        const [result] = await visionClient.documentTextDetection({
          image: { content: fileContent },
          imageContext: {
            languageHints: ['pt-BR', 'pt', 'en']
          }
        });
        
        text = result.fullTextAnnotation ? result.fullTextAnnotation.text : '';
        console.log(` Documento processado com sucesso. Texto extraido: ${text.substring(0, 100)}...`);
      } catch (docError) {
        console.error('Ã¢ÂÅ’ Erro ao processar documento:', docError);
        return res.status(400).json({ error: `N�o foi poss�vel processar o documento ${fileExt}` });
      }
    } else if (engine === 'tesseract') {
      try {
        const tempDir = ensureLocalDir();
        const tempFilePath = path.join(tempDir, `temp-${Date.now()}${fileExt}`);
        fs.writeFileSync(tempFilePath, fileContent);
        
        const { createWorker } = require('tesseract.js');
        const worker = await createWorker('por');
        const result = await worker.recognize(tempFilePath);
        text = result.data.text;
        await worker.terminate();
        
        // Remove o arquivo temporÃƒÂ¡rio
        fs.unlinkSync(tempFilePath);
      } catch (tessError) {
        console.error(' Erro ao processar com Tesseract:', tessError);
        return res.status(400).json({ error: 'n�o foi poss�vel processar o arquivo com Tesseract' });
      }
  } else if (engine === 'documentai') {
    console.log(` Processando documento usando Google Document AI`);
    try {
      if (!isDocumentAIReady()) {
        console.warn('[Receipts] Document AI solicitado, mas o cliente não está configurado.');
        return res.status(503).json({ error: 'Document AI não está configurado no servidor' });
      }
      // Formatar o nome do processador
      const processorName = `projects/${OCR_CONFIG.documentAIProjectId}/locations/${OCR_CONFIG.documentAILocation}/processors/${OCR_CONFIG.documentAIProcessorId}`;
        
        const request = {
          name: processorName,
          rawDocument: {
            content: fileContent.toString('base64'),
            mimeType: fileExt === '.pdf' ? 'application/pdf' : 
                      (fileExt === '.doc' || fileExt === '.docx') ? 'application/msword' : 
                      'image/jpeg'
          }
        };
        
        const [result] = await documentAIClient.processDocument(request);
        const { document } = result;
        text = document.text;
        req.documentAIEntities = extractDocumentAIData(document).extractedData;
      } catch (docAIError) {
        console.error(' Erro ao processar com Document AI:', docAIError);
        return res.status(400).json({ error: 'não foi possível processar o arquivo com Document AI' });
      }
    } else {
      // ÃƒÂ°Ã…Â¸Ã¢â‚¬ÂÃ¢â‚¬Å¾ OCR com Google Vision para imagens
      console.log(` Processando imagem usando Google Cloud Vision API`);
      try {
        // Usando Text Detection otimizado para imagens de recibos
        const [result] = await visionClient.textDetection({
          image: { content: fileContent },
          imageContext: {
            languageHints: ['pt-BR', 'pt', 'en']
          }
        });
        
        const detections = result.textAnnotations;
        text = detections.length > 0 ? detections[0].description : '';
        console.log(` Imagem processada com sucesso. Texto extraidos: ${text.substring(0, 100)}...`);
      } catch (imgError) {
        console.error(' Erro ao processar imagem:', imgError);
        return res.status(400).json({ error: 'não foi possível processar a imagem' });
      }
    }

    if (!text) {
      return res.status(400).json({ error: 'Nenhum texto detectado no canhoto' });
    }

    // Extrair dados estruturados do texto usando Google Cloud Vision
    console.log(' Extraindo dados estruturados do texto OCR');
    const ocrData = await extractStructuredData(text, fileExt, req.documentAIEntities);

    // Atualizar status do canhoto
    await pool.query(
      'UPDATE delivery_receipts SET ocr_data = ?, status = ?, processed_at = NOW() WHERE id = ?',
      [JSON.stringify(ocrData), 'PROCESSED', receiptId])

    res.json({
      success: true,
      data: {
        engine_used: engine,
        ocr_data: ocrData,
        raw_text: text
      }
    });

  } catch (error) {
    console.error('Erro no processamento OCR:', error);
    res.status(500).json({ error: error.message });
  }
});

// FunÃƒÂ§ÃƒÂ£o para extrair dados estruturados do Document AI

function extractDocumentAIData(document) {
  const labelStore = new Map();

  const normalizeString = (value) => {
    if (typeof value === 'string') {
      return value.trim();
    }
    if (typeof value === 'number') {
      return value.toString();
    }
    if (value && typeof value === 'object') {
      if (value.text) {
        return String(value.text).trim();
      }
      if (value.content) {
        return String(value.content).trim();
      }
    }
    return '';
  };

  const recordLabel = (label, value) => {
    const normalizedLabel = normalizeString(label).toLowerCase();
    const normalizedValue = normalizeString(value);
    if (!normalizedLabel || !normalizedValue) {
      return;
    }
    if (!labelStore.has(normalizedLabel)) {
      labelStore.set(normalizedLabel, []);
    }
    const bucket = labelStore.get(normalizedLabel);
    if (!bucket.includes(normalizedValue)) {
      bucket.push(normalizedValue);
    }
  };

  const normalizeCurrency = (value) => {
    const text = normalizeString(value);
    if (!text) return '';
    const moneyMatch = text.match(/[-\d.,]+/g);
    let cleaned = moneyMatch ? moneyMatch.join('') : text;
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',');
      const decimal = parts.pop();
      cleaned = parts.join('').replace(/\./g, '') + '.' + decimal;
    } else {
      cleaned = cleaned.replace(/[^\d.-]/g, '');
    }
    const parsed = parseFloat(cleaned);
    if (!Number.isFinite(parsed)) {
      return '';
    }
    return parsed.toFixed(2);
  };

  const normalizeTaxId = (value) => {
    const digits = normalizeString(value).replace(/\D/g, '');
    if (digits.length === 14) {
      return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    if (digits.length === 11) {
      return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    }
    return digits || '';
  };

  const normalizeDate = (value) => {
    if (!value) return '';
    if (typeof value === 'object' && value.year) {
      const year = value.year;
      const month = String(value.month || 1).padStart(2, '0');
      const day = String(value.day || 1).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    const text = normalizeString(value);
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      return text;
    }
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(text)) {
      const [day, month, year] = text.split('/');
      return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    }
    const parsed = new Date(text.replace(/\s+/, ' ').replace(/\s*(?:UTC|GMT).*/, ''));
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split('T')[0];
    }
    return '';
  };

  const getEntityValue = (entity) => {
    if (!entity) return '';
    if (entity.normalizedValue) {
      const { normalizedValue } = entity;
      if (normalizedValue.text) {
        return normalizedValue.text;
      }
      if (normalizedValue.moneyValue) {
        const units = Number(normalizedValue.moneyValue.units || 0);
        const nanos = Number(normalizedValue.moneyValue.nanos || 0) / 1e9;
        const total = units + nanos;
        return total ? total.toString() : '';
      }
      if (normalizedValue.dateValue) {
        return normalizeDate(normalizedValue.dateValue);
      }
    }
    if (entity.mentionText) {
      return entity.mentionText.trim();
    }
    if (entity.value) {
      return normalizeString(entity.value);
    }
    if (entity.textAnchor && document && document.text) {
      const segments = entity.textAnchor.textSegments || [];
      if (segments.length > 0) {
        const start = Number(segments[0].startIndex || 0);
        const end = Number(segments[0].endIndex || 0);
        if (!Number.isNaN(start) && !Number.isNaN(end) && end > start) {
          return document.text.substring(start, end).trim();
        }
      }
    }
    return '';
  };

  const processEntity = (entity, parentLabel = '') => {
    if (!entity) return;

    const labels = new Set();
    if (entity.type) {
      labels.add(entity.type.toLowerCase());
    }
    if (entity.fieldName && entity.fieldName.text) {
      const fieldLabel = entity.fieldName.text.toLowerCase();
      labels.add(fieldLabel);
      if (parentLabel) {
        labels.add(`${parentLabel}/${fieldLabel}`);
      }
    } else if (parentLabel) {
      labels.add(parentLabel);
    }

    const value = getEntityValue(entity);
    labels.forEach((label) => recordLabel(label, value));

    const nextParent = entity.type ? entity.type.toLowerCase() : parentLabel;
    if (Array.isArray(entity.properties)) {
      entity.properties.forEach((child) => {
        processEntity(child, nextParent);
      });
    }
  };

  if (Array.isArray(document?.entities)) {
    document.entities.forEach((entity) => processEntity(entity));
  }

  if (Array.isArray(document?.summaryFields)) {
    document.summaryFields.forEach((field) => {
      const label = field.type || (field.fieldName && field.fieldName.text) || '';
      const value = field.value || field.valueText || field; 
      recordLabel(label, getEntityValue({ value }));
    });
  }

  const takeFirst = (labels, formatter = normalizeString) => {
    for (const label of labels) {
      const bucket = labelStore.get(label);
      if (bucket && bucket.length) {
        const formatted = formatter(bucket[0]);
        if (formatted) {
          return formatted;
        }
      }
    }
    return '';
  };

  const takeFromAll = (labels, formatter = normalizeString) => {
    for (const label of labels) {
      const bucket = labelStore.get(label);
      if (bucket) {
        for (const entry of bucket) {
          const formatted = formatter(entry);
          if (formatted) {
            return formatted;
          }
        }
      }
    }
    return '';
  };

  const takeDate = (labels) => {
    const candidates = [];
    labels.forEach((label) => {
      const bucket = labelStore.get(label);
      if (bucket) {
        bucket.forEach((value) => {
          const normalized = normalizeDate(value);
          if (normalized) {
            candidates.push(normalized);
          }
        });
      }
    });
    if (!candidates.length) return '';
    candidates.sort();
    return candidates[0];
  };

  const takeCurrency = (labels) => takeFromAll(labels, normalizeCurrency);
  const takeTaxId = (labels) => takeFromAll(labels, normalizeTaxId);

  const takeNumber = (labels) => {
    return takeFromAll(labels, (value) => {
      const text = normalizeString(value);
      const match = text.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
      return match ? match[0] : '';
    });
  };

  const joinAddress = (labels) => {
    const parts = [];
    labels.forEach((label) => {
      const bucket = labelStore.get(label);
      if (bucket) {
        bucket.forEach((value) => {
          const normalized = normalizeString(value);
          if (normalized && !parts.includes(normalized)) {
            parts.push(normalized);
          }
        });
      }
    });
    return parts.join(', ');
  };

  const sanitizeNfNumber = (value) => {
    const digits = normalizeString(value).replace(/\D/g, '');
    return digits || '';
  };

  const extractedData = {
    // Capturando apenas os campos solicitados
    nfNumber: sanitizeNfNumber(takeFromAll(['nro', 'invoice_number', 'invoice_id', 'document_number'])),
    nfeKey: sanitizeNfNumber(takeFromAll(['nfe_key', 'access_key', 'chave_nfe', 'chave_de_acesso', 'chave'])),
    clientName: takeFirst(['receiver_name', 'ship_to_name', 'customer_name', 'destinatario_nome'], normalizeString),
    productValue: takeCurrency(['net_amount', 'valor_total_produtos', 'subtotal']),
    invoiceTotalValue: takeCurrency(['total_amount', 'amount_due', 'valor_total_nota', 'grand_total']),
    issueDate: takeDate(['issue_date', 'invoice_date', 'data_emissao', 'emission_date']),
    departureDate: takeDate(['ship_date', 'data_saida', 'shipment_date', 'dt_saida_entrada']),
  };

  // Se o valor total da nota não for encontrado, usar o valor dos produtos como fallback
  if (!extractedData.invoiceTotalValue && extractedData.productValue) {
    extractedData.invoiceTotalValue = extractedData.productValue;
  }

  return {
    extractedData,
    rawFields: Object.fromEntries(Array.from(labelStore.entries()).map(([key, value]) => [key, value.slice(0, 10)]))
  };
}
function calculateConfidence(document) {
  if (!document.entities || document.entities.length === 0) {
    return 0;
  }

  const confidences = document.entities
    .map(entity => entity.confidence || 0)
    .filter(conf => conf > 0);

  if (confidences.length === 0) {
    return 0;
  }

  return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
}

/**
 * @swagger
 * /api/delivery/{id}:
 *   get:
 *     summary: Obter dados de uma entrega
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: ID da entrega
 *     responses:
 *       200:
 *         description: Dados da entrega
 */
app.get('/api/delivery/:id', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const deliveryId = req.params.id;

    // Buscar a entrega no banco
    const [rows] = await pool.query(
      `SELECT d.*, r.id as receipt_id, r.image_url, r.ocr_data, r.validated
       FROM delivery_notes d
       LEFT JOIN delivery_receipts r ON r.delivery_note_id = d.id
       WHERE d.id = ? AND d.company_id = ?`,
      [deliveryId, req.user.company_id])

    if (!rows || rows.length === 0) {
      return res.status(404).json({ error: 'Entrega n�o encontrada' });
    }

    const delivery = rows[0];

    // Retornar dados da entrega + OCR (se existir)
    res.json({
      id: delivery.id,
      nfNumber: delivery.nf_number,
      clientName: delivery.client_name_extracted,
      clientCnpj: delivery.client_cnpj,
      deliveryAddress: delivery.delivery_address,
      merchandiseValue: delivery.value,
      volume: delivery.volume,
      weight: delivery.weight,
      issueDate: delivery.issue_date,
      dueDate: delivery.due_date,
      observations: delivery.notes,
      receipt: delivery.receipt_id ? {
        id: delivery.receipt_id,
        imageUrl: delivery.image_url,
        ocrData: delivery.ocr_data ? JSON.parse(delivery.ocr_data) : null,
        validated: delivery.validated
      } : null
    });
  } catch (error) {
    console.error('Erro ao buscar entrega:', error);
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
      [receiptId, req.user.company_id])

    if (receiptRows.length === 0) {
      return res.status(404).json({ error: 'Canhoto n�o encontrado' });
    }

    // Atualizar dados validados
    await pool.query(
      'UPDATE delivery_receipts SET validated_ocr_data = ?, corrections = ?, validated = ?, validated_at = NOW() WHERE id = ?',
      [JSON.stringify(ocr_data), JSON.stringify(corrections), validated, receiptId])

    res.json({
      success: true,
      message: 'Dados validados com sucesso'
    });

  } catch (error) {
    console.error('Erro na valida��o:', error);
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
      SELECT r.*, d.nf_number, d.client_name_extracted as client_name, u.full_name as driver_name
      FROM delivery_receipts r
      LEFT JOIN delivery_notes d ON r.delivery_note_id = d.id
      LEFT JOIN users u ON r.captured_by_user_id = u.id
      WHERE r.company_id = ?
    `;
    const params = [req.user.company_id];

    if (delivery_id) {
      query += ' AND r.delivery_note_id = ?';
      params.push(delivery_id);
    }

    if (driver_id) {
      query += ' AND r.captured_by_user_id = ?';
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

// FunÃƒÂ§ÃƒÂ£o para extrair dados estruturados do texto OCR com suporte a diferentes formatos de documento
async function extractStructuredData(text, fileExt = '', documentAIEntities = null) {
  console.log(` Extraindo dados estruturados do texto OCR (formato: ${fileExt || 'imagem'})`);
  
  const data = {
    nf_number: '',
    client_name: '',
    address: '',
    value: 0,
    items: [],
    document_type: fileExt ? fileExt.toLowerCase().replace('.', '') : 'imagem'
  };

  // Se temos entidades do Document AI, usamos elas prioritariamente
  if (documentAIEntities && Object.keys(documentAIEntities).length > 0) {
    console.log(' Usando entidades extraidas pelo Document AI');
    
    // Mapeamento de tipos de entidades do Document AI para nossos campos
    if (documentAIEntities['invoice_id'] || documentAIEntities['invoice_number']) {
      data.nf_number = documentAIEntities['invoice_id'] || documentAIEntities['invoice_number'];
    }
    
    if (documentAIEntities['customer_name'] || documentAIEntities['recipient']) {
      data.client_name = documentAIEntities['customer_name'] || documentAIEntities['recipient'];
    }
    
    if (documentAIEntities['address'] || documentAIEntities['delivery_address']) {
      data.address = documentAIEntities['address'] || documentAIEntities['delivery_address'];
    }
    
    if (documentAIEntities['total_amount'] || documentAIEntities['amount_due']) {
      const valueStr = documentAIEntities['total_amount'] || documentAIEntities['amount_due'];
      data.value = parseFloat(valueStr.replace(/[^\d.,]/g, '').replace(',', '.')) || 0;
    }
    
    // Adicionar itens se disponÃƒÂ­veis
    if (documentAIEntities['line_items'] && Array.isArray(documentAIEntities['line_items'])) {
      data.items = documentAIEntities['line_items'];
    }
    
    return data;
  }

  const normalizedText = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();

  // ExpressÃƒÂµes regulares melhoradas para diferentes formatos de documento
  const regexPatterns = {
    // PadrÃƒÂµes para nÃƒÂºmero da NF
    nf: [
      /NF[e\-]?[:\s]*(\d+)/i,
      /N[oÃ‚Âº][:\s]*(\d+)/i,
      /Nota\s*Fiscal[:\s]*(\d+)/i,
      /NÃƒÂºmero[:\s]*(\d+)/i,
      /\b(\d{6,9})\b/  // NÃƒÂºmeros longos isolados que podem ser NF
    ],
    // PadrÃƒÂµes para valor total
    value: [
      /total[:\s]*R?\$?\s*([\d.,]+)/i,
      /valor[:\s]*R?\$?\s*([\d.,]+)/i,
      /R\$\s*([\d.,]+)/i
    ],
    // PadrÃƒÂµes para nome do cliente
    client: [
      /cliente[:\s]*([^\n\r]{3,50})/i,
      /destinat[]rio[:\s]*([^\n\r]{3,50})/i,
      /nome[:\s]*([^\n\r]{3,50})/i,
      /raz[o\s*social[:\s]*([^\n\r]{3,50})/i
    ],
    // PadrÃƒÂµes para endereÃƒÂ§o
    address: [
      /endere[ÃƒÂ§c]o[:\s]*([^\n\r]{5,100})/i,
      /logradouro[:\s]*([^\n\r]{5,100})/i,
      /rua[:\s]*([^\n\r]{5,100})/i,
      /av[\.]?[:\s]*([^\n\r]{5,100})/i
    ],
    // PadrÃƒÂµes para CNPJ/CPF
    document: [
      /(\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2})/,  // CNPJ formatado
      /(\d{14})/,  // CNPJ sem formataÃƒÂ§ÃƒÂ£o
      /(\d{3}\.\d{3}\.\d{3}-\d{2})/,  // CPF formatado
      /(\d{11})/   // CPF sem formataÃƒÂ§ÃƒÂ£o
    ]
  };

  const extractWithPatterns = (patterns, text) => {
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match && match[1]) {
        return match[1].trim();
      }
    }
    return '';
  };

  data.nf_number = extractWithPatterns(regexPatterns.nf, normalizedText);

  // Extrair valor total
  const valueStr = extractWithPatterns(regexPatterns.value, normalizedText);
  if (valueStr) {
    // Normalizar formato numÃƒÂ©rico
    const normalizedValue = valueStr
      .replace(/[^\d,.]/g, '')
      .replace(',', '.');
    data.value = parseFloat(normalizedValue) || 0;
  }

  // Extrair nome do cliente
  data.client_name = extractWithPatterns(regexPatterns.client, normalizedText);

  if (!data.client_name) {
    const lines = text.split('\n');
    for (let i = 0; i < Math.min(10, lines.length); i++) {
      const line = lines[i].trim();
      if (line.length > 5 && !line.match(/^\d/) && !line.match(/total|valor|nota|fiscal|nf[e\-]?|cnpj|cpf/i)) {
        data.client_name = line;
        break;
      }
    }
  }

  // Extrair endereÃƒÂ§o
  data.address = extractWithPatterns(regexPatterns.address, normalizedText);

  // Processamento especÃƒÂ­fico para documentos Word
  if (fileExt && ['.doc', '.docx'].includes(fileExt.toLowerCase())) {
    // Documentos Word geralmente tÃƒÂªm formataÃƒÂ§ÃƒÂ£o mais estruturada
    // Podemos tentar extrair informaÃƒÂ§ÃƒÂµes de tabelas ou seÃƒÂ§ÃƒÂµes especÃƒÂ­ficas
    const paragraphs = text.split('\n\n');
    
    // Procurar por parÃƒÂ¡grafos que possam conter informaÃƒÂ§ÃƒÂµes de endereÃƒÂ§o
    for (const para of paragraphs) {
      if (para.match(/rua|avenida|av\.|logradouro|endere[ÃƒÂ§c]o/i) && !data.address) {
        data.address = para.trim();
      }
    }
  }

  // Processamento especÃƒÂ­fico para PDFs
  if (fileExt && ['.pdf'].includes(fileExt.toLowerCase())) {
    // PDFs podem ter estrutura mais complexa
    // Tentar identificar blocos de texto que possam ser itens
    const blocks = text.split('\n\n');
    const items = [];
    
    for (const block of blocks) {
      if (block.match(/\d+\s*x\s*\d+/) || block.match(/R\$\s*[\d.,]+/)) {
        items.push({
          description: block.trim(),
          extracted: true
        });
      }
    }
    
    if (items.length > 0) {
      data.items = items;
    }
  }

  console.log(' Dados estruturados extraido:', data);
  return data;
}

/**
 * @swagger
 * /api/receipts/process-documentai:
 *   post:
 *     summary: Processa um documento (imagem, PDF) usando o Google Document AI.
 *     description: Recebe um arquivo, o processa com um processador pré-configurado do Document AI e retorna os dados estruturados, texto bruto e outras informações.
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
 *                 description: O arquivo de imagem ou PDF a ser processado.
 *     responses:
 *       200:
 *         description: Documento processado com sucesso.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *       400:
 *         description: Arquivo não fornecido.
 *       503:
 *         description: Serviço do Document AI não configurado no backend.
 */
app.post('/api/receipts/process-documentai', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Arquivo nao fornecido' });
    }
    if (!isDocumentAIReady()) {
      return res.status(503).json({
        error: 'Document AI nao esta configurado no servidor',
        details: 'Verifique as credenciais e variaveis DOCUMENT_AI_* no backend.'
      });
    }

    // Adicionado: Verificação explícita para o ID do processador
    if (OCR_CONFIG.documentAIProcessorId === 'processor-id') {
      return res.status(503).json({
        error: 'Configuração do Document AI incompleta.',
        details: 'A variável de ambiente DOCUMENT_AI_PROCESSOR_ID não foi definida no servidor.'
      });
    }
    const processorName = `projects/${OCR_CONFIG.documentAIProjectId}/locations/${OCR_CONFIG.documentAILocation}/processors/${OCR_CONFIG.documentAIProcessorId}`;
    const [result] = await documentAIClient.processDocument({ name: processorName, rawDocument: { content: req.file.buffer.toString('base64'), mimeType: req.file.mimetype } });
    const { document } = result;
    const { extractedData, rawFields } = extractDocumentAIData(document);
    res.json({ success: true, data: { extractedData, rawText: document.text, entities: document.entities || [], confidence: calculateConfidence(document), rawFields } });
  } catch (error) {
    console.error('[Receipts] Erro ao processar com Document AI:', error);
    res.status(500).json({ error: 'Erro ao processar documento', details: error.message });
  }
});

// CORRE��O: Usa a porta do .env ou a porta padr�o 3004.
const PORT = Number(process.env.RECEIPTS_SERVICE_PORT || process.env.RECEIPTS_PORT || process.env.PORT || 3004);
app.listen(PORT, () => console.log(`Receipts OCR Service rodando na porta ${PORT}`));

module.exports = app;
