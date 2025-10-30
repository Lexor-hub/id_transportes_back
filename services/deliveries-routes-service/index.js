﻿require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const xml2js = require('xml2js');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const { Storage } = require('@google-cloud/storage');
const {
  ensureGoogleCredentialsFile,
  getServiceAccountProjectId,
} = require('../../shared/googleCredentials');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required for Deliveries/Routes service');
}

const authorize = (allowedRoles) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Acesso negado. Nenhum token fornecido.' });
    }

    const token = authHeader.split(' ')[1];

    try {
      const decoded = jwt.verify(token, jwtSecret, { ignoreExpiration: false });
      req.user = decoded;

      const userRole = decoded.user_type || decoded.role;

      if (allowedRoles.includes(userRole)) {
        next();
      } else {
        res.status(403).json({ success: false, error: 'Acesso negado. Você não tem permissão para este recurso.' });
      }
    } catch (error) {
      console.error("Erro de autenticação:", error.message);
      res.status(401).json({ success: false, error: 'Token inválido ou expirado.' });
    }
  };
};

/**
 * Busca os identificadores de um motorista (ID do registro e ID do usuário) no banco de dados.
 * Aceita tanto o ID do registro da tabela `drivers` quanto o ID da tabela `users`.
 * @param {string | number} id - O ID a ser procurado.
 * @param {string | number} companyId - O ID da empresa.
 * @returns {Promise<{id: string, user_id: string} | null>} - Um objeto com os IDs ou nulo se não encontrado.
 */
async function findDriverIdentifiers(id, companyId) {
  if (!id || !companyId) {
    return null;
  }
  try {
    // Tenta encontrar na tabela 'drivers' pelo id do registro ou pelo user_id
    const [rows] = await pool.query(
      'SELECT id, user_id FROM drivers WHERE (id = ? OR user_id = ?) AND company_id = ? LIMIT 1',
      [id, id, companyId]
    );
    if (rows.length > 0) {
      // Retorna o ID do registro e o ID do usuário
      return { id: rows[0].id, user_id: rows[0].user_id };
    }
    return null; // Retorna nulo se não encontrar um registro de motorista
  } catch (error) {
    console.error('Erro ao buscar identificadores do motorista:', error);
    return null;
  }
}
const OCR_CONFIG = {
  documentAIProjectId: process.env.DOCUMENT_AI_PROJECT_ID,
  documentAILocation: process.env.DOCUMENT_AI_LOCATION || 'us',
  documentAIProcessorId: process.env.DOCUMENT_AI_PROCESSOR_ID
};
const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);
const DELIVERY_ALERT_STORAGE_LIMIT = 50;

const DELIVERY_ALERT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS delivery_alerts (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    alert_identifier VARCHAR(191) NOT NULL,
    alert_type VARCHAR(64) NOT NULL,
    severity VARCHAR(32) NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    description TEXT,
    message TEXT,
    company_id VARCHAR(64),
    delivery_id VARCHAR(64),
    nf_number VARCHAR(191),
    driver_id VARCHAR(64),
    driver_name VARCHAR(191),
    vehicle_label VARCHAR(191),
    actor_id VARCHAR(64),
    actor_name VARCHAR(191),
    actor_role VARCHAR(64),
    occurred_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_delivery_alerts_company (company_id, occurred_at DESC)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function ensureDeliveryAlertsTable() {
  try {
    await pool.query(DELIVERY_ALERT_TABLE_SQL);
  } catch (error) {
    console.error('[Deliveries] Falha ao garantir tabela de alertas:', error);
  }
}

async function refreshDeliveryAlertsCache() {
  try {
    const [rows] = await pool.query(
      `SELECT alert_identifier, title, description, severity, occurred_at
         FROM delivery_alerts
        ORDER BY occurred_at DESC, id DESC
        LIMIT ?`,
      [DELIVERY_ALERT_STORAGE_LIMIT]
    );

    pushDeliveryAlert.cache = rows.map((row) => ({
      id: row.alert_identifier || `alert-${row.id}`,
      title: row.title || 'Alerta operacional',
      description: row.description || '',
      severity: row.severity || 'info',
      timestamp: row.occurred_at ? new Date(row.occurred_at).toISOString() : new Date().toISOString(),
    }));
  } catch (error) {
    console.error('[Deliveries] Falha ao atualizar cache de alertas:', error);
  }
}

async function pushDeliveryAlert(rawAlert) {
  if (!rawAlert || typeof rawAlert !== 'object') return;

  const normalizedTimestamp =
    rawAlert.timestamp && typeof rawAlert.timestamp === 'string'
      ? rawAlert.timestamp
      : new Date().toISOString();

  const type = rawAlert.type ? String(rawAlert.type) : 'delivery_deleted';
  const message = rawAlert.message ? String(rawAlert.message) : null;
  const nfNumber = rawAlert.nfNumber ? String(rawAlert.nfNumber) : null;
  const driverName = rawAlert.driverName ? String(rawAlert.driverName) : null;
  const vehicleLabel = rawAlert.vehicleLabel ? String(rawAlert.vehicleLabel) : null;
  const actorName = rawAlert.actorName ? String(rawAlert.actorName) : null;

  const descriptionParts = [];
  if (message && message.trim().length) {
    descriptionParts.push(message.trim());
  }
  if (nfNumber) descriptionParts.push(`NF ${nfNumber}`);
  if (driverName) descriptionParts.push(`Motorista: ${driverName}`);
  if (vehicleLabel) descriptionParts.push(`Veiculo: ${vehicleLabel}`);
  if (actorName && (!driverName || actorName !== driverName)) {
    descriptionParts.push(`Acao por: ${actorName}`);
  }

  const description = descriptionParts.length
    ? descriptionParts.join(' | ')
    : 'Entrega removida pelo motorista.';

  const normalized = {
    id: rawAlert.id ? String(rawAlert.id) : `${normalizedTimestamp}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    severity: rawAlert.severity ? String(rawAlert.severity) : (type === 'delivery_deleted' ? 'danger' : 'info'),
    title:
      rawAlert.title && typeof rawAlert.title === 'string' && rawAlert.title.trim().length
        ? rawAlert.title.trim()
        : type === 'delivery_deleted'
          ? 'Entrega excluida pelo motorista'
          : 'Alerta operacional',
    description,
    message,
    companyId: rawAlert.companyId ? String(rawAlert.companyId) : null,
    deliveryId: rawAlert.deliveryId ? String(rawAlert.deliveryId) : null,
    nfNumber,
    driverId: rawAlert.driverId ? String(rawAlert.driverId) : null,
    driverName,
    vehicleLabel,
    actorId: rawAlert.actorId ? String(rawAlert.actorId) : null,
    actorName,
    actorRole: rawAlert.actorRole ? String(rawAlert.actorRole) : null,
    timestamp: normalizedTimestamp,
  };

  try {
    await pool.query(
      `INSERT INTO delivery_alerts (
        alert_identifier, alert_type, severity, title, description, message,
        company_id, delivery_id, nf_number, driver_id, driver_name, vehicle_label,
        actor_id, actor_name, actor_role, occurred_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        normalized.id,
        normalized.type,
        normalized.severity,
        normalized.title,
        normalized.description,
        normalized.message,
        normalized.companyId,
        normalized.deliveryId,
        normalized.nfNumber,
        normalized.driverId,
        normalized.driverName,
        normalized.vehicleLabel,
        normalized.actorId,
        normalized.actorName,
        normalized.actorRole,
        new Date(normalized.timestamp),
      ]
    );
  } catch (error) {
    console.error('[Deliveries] Falha ao persistir alerta de entrega:', error);
  }

  await refreshDeliveryAlertsCache();
}

pushDeliveryAlert.cache = [];

void ensureDeliveryAlertsTable()
  .then(() => refreshDeliveryAlertsCache())
  .catch((error) => {
    console.error('[Deliveries] Falha ao preparar tabela de alertas:', error);
  });




// Centralizar a inicialização dos clientes do Google Cloud
ensureGoogleCredentialsFile();
const serviceAccountProjectId = getServiceAccountProjectId();
if (!process.env.DOCUMENT_AI_PROJECT_ID && serviceAccountProjectId) {
  process.env.DOCUMENT_AI_PROJECT_ID = serviceAccountProjectId;
}

const hasGoogleCredentials = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
let documentAIClient = null;
let storage = null;
let bucket = null;

if (hasGoogleCredentials) {
  try {
    documentAIClient = new DocumentProcessorServiceClient();
    storage = new Storage();
    if (process.env.GCS_BUCKET_NAME) {
      bucket = storage.bucket(process.env.GCS_BUCKET_NAME);
      console.log('✅ Google Cloud Storage configurado com sucesso');
    }
  } catch (error) {
    console.warn('⚠️ Erro ao configurar Google Cloud Services:', error.message);
    console.warn('⚠️ Usando armazenamento local como fallback.');
  }
} else {
  console.warn('⚠️ Google Cloud Storage não configurado. Usando armazenamento local.');
}

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

// ✅ Standardized CORS Configuration
const cors = require('cors');
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

    if (whitelist.some((pattern) => (pattern instanceof RegExp ? pattern.test(origin) : pattern === origin))) {
      return callback(null, true);
    }

    console.error(`[Deliveries CORS] Origin '${origin}' not allowed.`);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
};

app.use(cors(corsOptions));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
// Configuração do Multer para upload de arquivos em memória
const memoryUpload = multer({ storage: multer.memoryStorage() });


// Função para enviar arquivo ao Google Cloud Storage
async function uploadToGCS(file, folder = 'receipts') {
  if (!file) {
    throw new Error('Arquivo não fornecido para upload.');
  }

  // Se o bucket não estiver configurado, salva localmente
  if (!bucket) {
    const uploadDir = path.join(__dirname, `uploads/${folder}`);
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname || '')}`;
    const filePath = path.join(uploadDir, uniqueName);
    fs.writeFileSync(filePath, file.buffer || file.path);
    const localUrl = `/uploads/${folder}/${uniqueName}`;
    return { publicUrl: localUrl, gcsPath: filePath };
  }

  // Upload para o Google Cloud Storage
  return new Promise((resolve, reject) => {
    const uniqueName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname || '')}`;
    const blob = bucket.file(uniqueName);
    const blobStream = blob.createWriteStream({
      resumable: false,
      contentType: file.mimetype
    });

    blobStream.on('error', err => reject(err));
    blobStream.on('finish', () => {
      const publicUrl = `https://storage.googleapis.com/${bucket.name}/${blob.name}`;
      resolve({ publicUrl, gcsPath: blob.name });
    });

    if (file.buffer) {
      blobStream.end(file.buffer);
    } else if (file.path) {
      fs.createReadStream(file.path).pipe(blobStream);
    } else {
      reject(new Error('Arquivo inválido: nem buffer nem path não foram fornecidos'));
    }
  });
}

function extractSefazDataFromText(text) {
  try {
    const norm = (s) => (s ? String(s).trim() : '');
    const clean = (s) => norm(s).replace(/\s+/g, ' ');
    const digits = (s) => norm(s).replace(/\D+/g, '');

    const chRegexes = [
      /chave\s*(?:de\s*acesso)?\s*[:\-]?\s*([\d\s\.]{30,80})/i,
      /(\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{3})/
    ];
    let chNFe = '';
    for (const r of chRegexes) {
      const m = text.match(r);
      if (m) { chNFe = digits(m[1] || m[0]); break; }
    }
    if (chNFe.length > 44) chNFe = chNFe.slice(-44);

    const nfRegexes = [
      /n[Âºo]\s*(?:da\s*)?nota\s*fiscal[:\-\s]*([0-9]{1,9})/i,
      /n[ºo]\s*[:\-]?\s*(\d{1,9})\s*\/\s*s[eé]rie/i, // Corrigido
      /n[Âºo]\s*nf[:\-\s]*([0-9]{1,9})/i,
      /n\.?\s*nf-?e?\s*[:\-\s]*([0-9]{1,9})/i,
      /nfe\s*n[Âºo]\.?\s*[:\-\s]*(\d{1,9})/i,
      /nro\.?\s*(\d{1,9})\s*s[eé]rie/i, // Corrigido
      /nf-e\s*s[eé]rie[:\-\s]*\d+\s*n[ºo]\.?[:\-\s]*(\d{1,9})/i // Corrigido
    ];

    let nfNumber = '';
    for (const r of nfRegexes) {
      const m = text.match(r);
      if (m) { nfNumber = m[1]; break; }
    }

    const serieRegexes = [
      /s[eé]rie[:\-\s]*([0-9A-Za-z\-]{1,5})/i, // Corrigido
      /nf-e\s*s[eé]rie[:\-\s]*([0-9A-Za-z\-]{1,5})/i // Corrigido
    ];

    let serie = '';
    for (const r of serieRegexes) {
      const m = text.match(r);
      if (m) { serie = m[1]; break; }
    }

    const emitenteRegexes = [
      /emitente[:\-\s]*([^\n\r]{3,120})/i,
      /raz[aã]o\s*social[:\-\s]*([^\n\r]{3,120})/i, // Corrigido
      /nome\s*\/\s*raz[aã]o\s*social[:\-\s]*([^\n\r]{3,120})/i // Corrigido
    ];

    let xNomeEmit = '';
    for (const r of emitenteRegexes) {
      const m = text.match(r);
      if (m) { xNomeEmit = clean(m[1]); break; }
    }

    const destRegexes = [
      /destinat[aá]rio[:\-\s]*([^\n\r]{3,120})/i, // Corrigido
      /nome\s*do\s*destinat[aá]rio[:\-\s]*([^\n\r]{3,120})/i, // Corrigido
      /destinat[aá]rio\s*\/\s*remetente[:\-\s]*nome\s*\/\s*raz[aã]o\s*social[:\-\s]*([^\n\r]{3,120})/i // Corrigido
    ];

    let xNomeDest = '';
    for (const r of destRegexes) {
      const m = text.match(r);
      if (m) { xNomeDest = clean(m[1]); break; }
    }

    const cnpjCpfRegexes = [
      /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g,
      /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/g
    ];

    let cnpjCpfMatches = [];
    for (const r of cnpjCpfRegexes) {
      const matches = [...text.matchAll(r)].map(m => digits(m[0]));
      if (matches.length > 0) {
        cnpjCpfMatches = [...cnpjCpfMatches, ...matches];
      }
    }

    const uniq = Array.from(new Set(cnpjCpfMatches)).filter(Boolean);

    const enderecoRegexes = [
      /endereço[:\-\s]*([^\n\r]{3,120})/i, // Corrigido
      /logradouro[:\-\s]*([^\n\r]{3,120})/i
    ];

    let endereco = '';
    for (const r of enderecoRegexes) {
      const m = text.match(r);
      if (m) { endereco = clean(m[1]); break; }
    }

    const cepMatch = text.match(/CEP[:\-\s]*([0-9]{5}-?[0-9]{3})/i);
    const cep = cepMatch ? cepMatch[1] : '';

    const municipioMatch = text.match(/município[:\-\s]*([^\n\r]{3,50})/i,); // Corrigido
    const municipio = municipioMatch ? clean(municipioMatch[1]) : '';

    const ufMatch = text.match(/UF[:\-\s]*([A-Z]{2})/i);
    const uf = ufMatch ? ufMatch[1] : '';

    const valorRegexes = [
      /valor\s*total\s*da\s*nota[:\-\s]*([0-9\.,]{1,20})/i,
      /valor\s*total[:\-\s]*([0-9\.,]{1,20})/i
    ];

    let valorNota = '';
    for (const r of valorRegexes) {
      const m = text.match(r);
      if (m) { valorNota = m[1].replace(/\./g, '').replace(',', '.'); break; }
    }

    const volumeMatch = text.match(/quantidade\s*de\s*volume\(?s?\)?[:\-\s]*([0-9]{1,5})/i);
    const volume = volumeMatch ? volumeMatch[1] : '';

    const pesoBrutoMatch = text.match(/peso\s*bruto[:\-\s]*([0-9\.,]{1,10})/i);
    const pesoBruto = pesoBrutoMatch ? pesoBrutoMatch[1].replace(/\./g, '').replace(',', '.') : '';

    const pesoLiquidoMatch = text.match(/peso\s*líquido[:\-\s]*([0-9\.,]{1,10})/i,); // Corrigido
    const pesoLiquido = pesoLiquidoMatch ? pesoLiquidoMatch[1].replace(/\./g, '').replace(',', '.') : '';

    let enderecoCompleto = endereco;
    if (municipio) {
      enderecoCompleto += enderecoCompleto ? `, ${municipio}` : municipio;
    }
    if (uf) {
      enderecoCompleto += enderecoCompleto ? ` - ${uf}` : uf;
    }
    if (cep) {
      enderecoCompleto += enderecoCompleto ? `, CEP: ${cep}` : `CEP: ${cep}`;
    }

    return {
      chNFe,
      nfNumber: nfNumber || '',
      serie: serie || '',
      dhEmi: '',
      emitente: {
        cnpj: uniq[0] || '',
        xNome: xNomeEmit,
        enderEmit: {
          xLgr: endereco,
          xMun: municipio,
          UF: uf,
          CEP: cep,
          xEndCompleto: enderecoCompleto
        }
      },
      destinatario: {
        cnpj: uniq[1] || '',
        xNome: xNomeDest,
        enderDest: {
          xLgr: endereco,
          xMun: municipio,
          UF: uf,
          CEP: cep,
          xEndCompleto: enderecoCompleto
        }
      },
      valores: {
        vNF: valorNota,
        vProd: valorNota
      },
      transporte: {
        modFrete: '',
        transportadora: null,
        volumes: {
          qVol: volume || '1',
          esp: '',
          pesoL: pesoLiquido || '0',
          pesoB: pesoBruto || '0'
        }
      }
    };
  } catch (e) {
    throw new Error(`Erro ao extrair dados do texto: ${e.message}`);
  }
}

function parseJSONField(value, fieldName) {
  if (!value) {
    return null;
  }
  if (typeof value === 'object') {
    return value;
  }
  if (typeof value !== 'string') {
    return null;
  }
  try {
    return JSON.parse(value);
  } catch (error) {
    console.warn(`[Deliveries] Could not parse ${fieldName}:`, error.message);
    return null;
  }
}

function firstNonEmpty(...values) {
  for (const entry of values) {
    if (entry === null || typeof entry === 'undefined') {
      continue;
    }
    if (typeof entry === 'string') {
      const trimmed = entry.trim();
      if (trimmed === '') {
        continue;
      }
      return trimmed;
    }
    return entry;
  }
  return null;
}

function parseDecimal(value) {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const cleaned = value
    .replace(/[^0-9,.-]/g, '')
    .replace(/(?!^)-/g, '')
    .trim();
  if (!cleaned) {
    return null;
  }
  let normalized = cleaned;
  if (cleaned.includes(',') && cleaned.includes('.')) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else if (cleaned.includes(',')) {
    normalized = cleaned.replace(',', '.');
  }
  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  if (value === null || typeof value === 'undefined') {
    return null;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : null;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const digits = value.replace(/[^0-9-]/g, '');
  if (!digits) {
    return null;
  }
  const parsed = parseInt(digits, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDateValue(value) {
  if (!value) {
    return null;
  }
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'number') {
    const asDate = new Date(value);
    return Number.isNaN(asDate.getTime()) ? null : asDate;
  }
  if (typeof value !== 'string') {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return new Date(`${trimmed}T00:00:00Z`);
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [day, month, year] = trimmed.split('/');
    return new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00Z`);
  }
  const parsed = Date.parse(trimmed);
  return Number.isNaN(parsed) ? null : new Date(parsed);
}

async function extractTextWithDocumentAI(buffer, mimeType) {
  if (!buffer || !documentAIClient || !OCR_CONFIG.documentAIProjectId || !OCR_CONFIG.documentAIProcessorId) {
    return '';
  }

  try {
    const name = `projects/${OCR_CONFIG.documentAIProjectId}/locations/${OCR_CONFIG.documentAILocation}/processors/${OCR_CONFIG.documentAIProcessorId}`;
    const request = {
      name,
      rawDocument: {
        content: buffer,
        mimeType,
      },
    };
    const [result] = await documentAIClient.processDocument(request);
    return (result && result.document && result.document.text) || '';
  } catch (error) {
    console.warn('[Deliveries] Document AI extraction failed:', error.message);
    return '';
  }
}

async function ensureInvoiceTables() {
  const createDetailsTable = `
    CREATE TABLE IF NOT EXISTS delivery_invoice_details (
      id INT PRIMARY KEY AUTO_INCREMENT,
      delivery_note_id INT NOT NULL,
      nf_data JSON,
      remetente JSON,
      destinatario JSON,
      valores JSON,
      transportadora JSON,
      volumes JSON,
      impostos JSON,
      informacoes_complementares TEXT,
      raw_text LONGTEXT,
      raw_fields JSON,
      document_ai_confidence DECIMAL(10,4),
      document_ai_entities JSON,
      status VARCHAR(50) DEFAULT 'PENDENTE',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  const createLineItemsTable = `
    CREATE TABLE IF NOT EXISTS delivery_invoice_line_items (
      id INT PRIMARY KEY AUTO_INCREMENT,
      invoice_details_id INT NOT NULL,
      item JSON,
      FOREIGN KEY (invoice_details_id) REFERENCES delivery_invoice_details(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  // Esta função agora apenas define as queries, a execução pode ser implementada se necessário. // Corrigido
}

app.get('/api/occurrences/:id', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const occurrenceId = req.params.id;

    const [rows] = await pool.query(`
      SELECT
        o.*,
        d.nf_number,
        d.client_name_extracted as client_name,
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

    const delivery = rows[0];

    res.json({
      success: true,
      data: delivery
    });

  } catch (error) {
    console.error('Erro ao obter ocorrência:', error);
    res.status(500).json({ error: error.message });
  }
});

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

app.post('/api/deliveries/create-from-sefaz', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), memoryUpload.any(), async (req, res) => {
  try {
    const file = req.files && req.files.length > 0 ? req.files[0] : null;
    const { company_id, id: userId } = req.user;

    const summaryPayload = parseJSONField(req.body?.summary, 'summary');
    const structuredPayload = parseJSONField(req.body?.structured, 'structured');
    const rawTextFromBody = typeof req.body?.raw_text === 'string' && req.body.raw_text ? req.body.raw_text : null;
    const driverIdFromBody = firstNonEmpty(req.body?.driver_id, req.body?.driverId);
    const requestedStatus = typeof req.body?.status === 'string' && req.body.status.trim() ? req.body.status.trim().toUpperCase() : 'PENDING';
    const notesFromBody = typeof req.body?.notes === 'string' && req.body.notes.trim() ? req.body.notes.trim() : null;
    const isSefazValid = req.body?.isSefazValid === true || req.body?.isSefazValid === 'true';

    console.log('[Deliveries] POST /api/deliveries/create-from-sefaz', {
      hasFile: Boolean(file),
      mimetype: file ? file.mimetype : null,
      hasSummary: Boolean(summaryPayload),
      hasStructured: Boolean(structuredPayload),
    });

    if (!file && !summaryPayload && !structuredPayload) {
      return res.status(400).json({ success: false, error: 'No document or structured data was provided.' });
    }

    let textContent = '';
    let extractedData = null;

    if (file) {
      const fileBuffer = file.buffer;

      if (file.mimetype === 'application/xml' || file.mimetype === 'text/xml') {
        textContent = fileBuffer.toString('utf-8');
      } else if (file.mimetype === 'application/pdf') {
        const data = await pdfParse(fileBuffer);
        textContent = data.text;
      } else if (IMAGE_MIME_TYPES.has(file.mimetype)) {
        textContent =
          (structuredPayload && structuredPayload.raw_text) ||
          rawTextFromBody ||
          (await extractTextWithDocumentAI(fileBuffer, file.mimetype));
      } else {
        return res.status(400).json({ success: false, error: 'Formato de arquivo não suportado. Envie XML, PDF ou imagem.' });
      }
    } else if (structuredPayload && structuredPayload.raw_text) {
      textContent = structuredPayload.raw_text;
    } else if (rawTextFromBody) {
      textContent = rawTextFromBody;
    }

    if (textContent) {
      try {
        extractedData = extractSefazDataFromText(textContent);
      } catch (extractionError) {
        console.warn('[Deliveries] Failed to extract data from text:', extractionError.message);
      }
    }

    const nfNumber = firstNonEmpty(
      summaryPayload && summaryPayload.nf_number,
      structuredPayload && structuredPayload.nf_data && structuredPayload.nf_data.numero,
      extractedData && extractedData.nfNumber
    );

    if (!nfNumber) {
      return res.status(400).json({ success: false, error: 'Não foi possível identificar o número da nota fiscal.' });
    }

    const clientName = firstNonEmpty(
      summaryPayload && summaryPayload.client_name,
      structuredPayload && structuredPayload.destinatario && structuredPayload.destinatario.razao_social,
      extractedData && extractedData.destinatario && extractedData.destinatario.xNome
    );

    const structuredAddressParts = structuredPayload && structuredPayload.destinatario
      ? [
          structuredPayload.destinatario.endereco,
          structuredPayload.destinatario.municipio,
          structuredPayload.destinatario.uf,
          structuredPayload.destinatario.cep,
        ].filter(Boolean)
      : [];

    const clientAddress = firstNonEmpty(
      summaryPayload && summaryPayload.delivery_address,
      structuredAddressParts.length ? structuredAddressParts.join(', ') : null,
      extractedData &&
        extractedData.destinatario &&
        extractedData.destinatario.enderDest &&
        extractedData.destinatario.enderDest.xEndCompleto
    );

    const normalizedClientAddress =
      typeof clientAddress === 'string' && clientAddress.trim()
        ? clientAddress.trim()
        : 'Não informado';

    const merchandiseValue = firstNonEmpty(
      parseDecimal(summaryPayload && summaryPayload.merchandise_value),
      parseDecimal(structuredPayload && structuredPayload.valores && structuredPayload.valores.valor_total_nota),
      parseDecimal(extractedData && extractedData.valores && extractedData.valores.vNF)
    );

    const deliveryVolume =
      firstNonEmpty(
        parseInteger(summaryPayload && summaryPayload.volume),
        parseInteger(structuredPayload && structuredPayload.volumes && structuredPayload.volumes.quantidade),
        parseInteger(
          extractedData &&
            extractedData.transporte &&
            extractedData.transporte.volumes &&
            extractedData.transporte.volumes.qVol
        )
      ) || 1;

    const nfKey = firstNonEmpty(
      structuredPayload && structuredPayload.nf_data && structuredPayload.nf_data.chave,
      extractedData && extractedData.nf_key,
      extractedData && extractedData.chNFe
    );

    const emissionDate = firstNonEmpty(
      parseDateValue(structuredPayload && structuredPayload.nf_data && structuredPayload.nf_data.data_emissao),
      parseDateValue(extractedData && extractedData.dhEmi)
    );

    const expectedDate = firstNonEmpty(
      parseDateValue(structuredPayload && structuredPayload.nf_data && structuredPayload.nf_data.data_saida),
      // CORREÇÃO: Prioriza o campo delivery_date_expected do summaryPayload, que vem do frontend.
      parseDateValue(summaryPayload?.delivery_date_expected)
    );

    const sanitizedNfNumber = nfNumber != null ? String(nfNumber).trim() : '';
    const sanitizedNfKeyRaw = nfKey != null ? String(nfKey).replace(/\s+/g, '') : '';
    const sanitizedNfKey = sanitizedNfKeyRaw.length ? sanitizedNfKeyRaw : null;

    if (sanitizedNfNumber) {
      const [existingDeliveries] = await pool.query(
        'SELECT id FROM delivery_notes WHERE company_id = ? AND nf_number = ? AND ((? IS NOT NULL AND nfe_key = ?) OR (? IS NULL AND (nfe_key IS NULL OR nfe_key = ""))) LIMIT 1',
        [company_id, sanitizedNfNumber, sanitizedNfKey, sanitizedNfKey, sanitizedNfKey]
      );

      if (Array.isArray(existingDeliveries) && existingDeliveries.length > 0) {
        return res.status(409).json({
          success: false, // Corrigido
          error: 'Já existe uma entrega com este número de NF e chave.',
        });
      }
    }

    if (structuredPayload && structuredPayload.nf_data) {
      if (sanitizedNfNumber) {
        structuredPayload.nf_data.numero = sanitizedNfNumber;
      }
      if (sanitizedNfKey) {
        structuredPayload.nf_data.chave = sanitizedNfKey;
      }
    }

    if (summaryPayload) {
      if (sanitizedNfNumber) {
        summaryPayload.nf_number = sanitizedNfNumber;
      }
      if (sanitizedNfKey) {
        summaryPayload.nfe_key = sanitizedNfKey;
      }
    }

    const newDelivery = {
      company_id,
      nf_number: sanitizedNfNumber || null,
      client_name_extracted: clientName || null,
      delivery_address: normalizedClientAddress,
      merchandise_value: typeof merchandiseValue === 'number' ? merchandiseValue : 0,
      delivery_volume: deliveryVolume,
      status: requestedStatus || 'PENDING',
      created_by_user_id: userId,
      // Ensure created_at is populated so server-side DATE(...) filters that
      // check CURDATE() will match newly created deliveries.
      created_at: new Date(),
      emission_date: emissionDate || null,
      nfe_key: sanitizedNfKey,
      delivery_date_expected: expectedDate || null,
      notes: notesFromBody,
    };

    const driverIdNormalized = parseInteger(driverIdFromBody);
    if (driverIdNormalized !== null) {
      newDelivery.driver_id = driverIdNormalized;
    }

    const [result] = await pool.query('INSERT INTO delivery_notes SET ?', newDelivery);
    const insertId = result.insertId;

    if (structuredPayload) {
      try {
        const [detailsResult] = await pool.query(
          'INSERT INTO delivery_invoice_details (delivery_note_id, nf_data, remetente, destinatario, valores, transportadora, volumes, impostos, informacoes_complementares, raw_text, raw_fields, document_ai_confidence, document_ai_entities, metadata, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [
            insertId,
            structuredPayload.nf_data ? JSON.stringify(structuredPayload.nf_data) : null,
            structuredPayload.remetente ? JSON.stringify(structuredPayload.remetente) : null,
            structuredPayload.destinatario ? JSON.stringify(structuredPayload.destinatario) : null,
            structuredPayload.valores ? JSON.stringify(structuredPayload.valores) : null,
            structuredPayload.transportadora ? JSON.stringify(structuredPayload.transportadora) : null,
            structuredPayload.volumes ? JSON.stringify(structuredPayload.volumes) : null,
            structuredPayload.impostos ? JSON.stringify(structuredPayload.impostos) : null,
            structuredPayload.informacoes_complementares || null,
            structuredPayload.raw_text || textContent || null,
            structuredPayload.raw_fields ? JSON.stringify(structuredPayload.raw_fields) : null,
            typeof structuredPayload.document_ai_confidence === 'number' ? structuredPayload.document_ai_confidence : null,
            Array.isArray(structuredPayload.document_ai_entities) && structuredPayload.document_ai_entities.length ? JSON.stringify(structuredPayload.document_ai_entities) : null,
            JSON.stringify({ summary: summaryPayload || null, isSefazValid: Boolean(isSefazValid), source: 'upload' }),
            structuredPayload.status || 'PENDENTE',
          ]
        );

        const invoiceDetailsId = detailsResult.insertId;

        if (Array.isArray(structuredPayload.itens_de_linha) && structuredPayload.itens_de_linha.length) {
          const itemsValues = structuredPayload.itens_de_linha
            .filter(Boolean)
            .map((item) => [invoiceDetailsId, JSON.stringify(item)]);
          if (itemsValues.length) {
            await pool.query(
              'INSERT INTO delivery_invoice_line_items (invoice_details_id, item) VALUES ?',
              [itemsValues]
            );
          }
        }
      } catch (detailsError) {
        console.warn('[Deliveries] Failed to persist structured invoice details:', detailsError.message);
      }
    }

    const [rows] = await pool.query('SELECT * FROM delivery_notes WHERE id = ?', [insertId]);

    res.status(201).json({
      success: true,
      message: 'Entrega criada com sucesso a partir do documento.',
      data: rows[0],
    });
  } catch (error) {
    console.error('Erro ao criar entrega a partir do SEFAZ:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, error: 'Uma entrega com este número de NF-e já existe.' }); // Corrigido
    }
    res.status(500).json({ success: false, error: error.message || 'Erro interno do servidor.' });
  }
});


app.get('/api/deliveries', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const { status, client_id, start_date, end_date, driver_id: driverFilterId } = req.query;
    const user = req.user;
    const driverOpenStatuses = ['PENDING', 'IN_TRANSIT', 'PENDENTE', 'EM_ANDAMENTO', 'PROBLEM', 'REATTEMPTED'];

    const userLogMetadata = {
      id: typeof user?.id !== 'undefined' ? user.id : null,
      user_id: typeof user?.user_id !== 'undefined' ? user.user_id : null,
      user_type: typeof user?.user_type !== 'undefined' ? user.user_type : null,
      company_id: typeof user?.company_id !== 'undefined' ? user.company_id : null,
    };

    console.log('[Deliveries] GET /api/deliveries - request received', {
      query: req.query,
      user: userLogMetadata,
    });

    let driverRowFromToken = null;
    if (user.user_type === 'DRIVER' || user.user_type === 'MOTORISTA') {
      driverRowFromToken = await findDriverIdentifiers(user.user_id ?? user.id, user.company_id);
      console.log('[Deliveries] GET /api/deliveries - driver row from token', driverRowFromToken);
    }

    let query = `
      SELECT 
        d.*,
        COALESCE(u.full_name, u_resolved.full_name) as driver_name,
        drv.user_id as driver_user_id,
        CONCAT(v.plate, ' - ', v.model) as vehicle_label,
        c.name as client_name,
        c.address as client_address,
        dr.id AS receipt_id,
        dr.image_url AS receipt_image_url,
        CASE WHEN dr.id IS NOT NULL THEN 1 ELSE 0 END AS has_receipt
      FROM delivery_notes d
      LEFT JOIN (
          SELECT driver_id, vehicle_id, MAX(start_datetime) as last_route_start
          FROM routes WHERE status = 'IN_PROGRESS' GROUP BY driver_id, vehicle_id
      ) latest_route ON latest_route.driver_id = d.driver_id
      LEFT JOIN vehicles v ON latest_route.vehicle_id = v.id
      LEFT JOIN users u ON d.driver_id = u.id
      LEFT JOIN drivers drv ON drv.company_id = d.company_id AND drv.id = d.driver_id
      LEFT JOIN users u_resolved ON drv.user_id = u_resolved.id
      LEFT JOIN clients c ON d.client_id = c.id
      LEFT JOIN delivery_receipts dr ON dr.delivery_note_id = d.id
      WHERE d.company_id = ?
    `;

    const params = [user.company_id];

    if (user.user_type === 'DRIVER' || user.user_type === 'MOTORISTA') {
      const driverUserId = user.user_id ?? user.id;
      const driverIdentifiers = await findDriverIdentifiers(driverUserId, user.company_id);
      const possibleIds = new Set([driverUserId, driverIdentifiers?.id, driverIdentifiers?.user_id].filter(Boolean).map(String));

      if (possibleIds.size > 0) {
        const placeholders = Array.from(possibleIds).map(() => '?').join(',');
        query += ` AND d.driver_id IN (${placeholders})`;
        params.push(...Array.from(possibleIds));
      }
    } else if (driverFilterId) {
      const driverRow = await findDriverIdentifiers(driverFilterId, user.company_id);
      console.log('[Deliveries] GET /api/deliveries - driver row from filter', { driverFilterId, driverRow });
      if (driverRow && driverRow.user_id) {
        const driverUserIdFromFilter = String(driverRow.user_id);
        const driverRecordIdFromFilter = driverRow.id ? String(driverRow.id) : null;
        query += ' AND (d.driver_id = ?';
        params.push(driverUserIdFromFilter);
        if (driverRecordIdFromFilter && driverRecordIdFromFilter !== driverUserIdFromFilter) {
          query += ' OR d.driver_id = ?';
          params.push(driverRecordIdFromFilter);
        }
        query += ')';
      } else {
        query += ' AND d.driver_id = ?';
        params.push(driverFilterId);
      }
    }

    if (status) {
      query += ' AND d.status = ?';
      params.push(status);
    }

    if (client_id) {
      query += ' AND d.client_id = ?';
      params.push(client_id);
    }

    // Lógica de filtro de data e status refatorada para maior clareza e correção.
    const deliveryDateExpr = 'DATE(COALESCE(d.delivery_date_expected, d.created_at))';
    const openStatuses = ['PENDING', 'IN_TRANSIT', 'PENDENTE', 'EM_ANDAMENTO', 'PROBLEM', 'REATTEMPTED'];

    if (user.user_type === 'DRIVER' || user.user_type === 'MOTORISTA') {
      // Para motoristas, mostrar entregas do dia OU qualquer entrega com status em aberto.
      // Isso garante que entregas antigas não resolvidas continuem visíveis.
      if (start_date && end_date) {
        query += ` AND ${deliveryDateExpr} BETWEEN ? AND ?`;
        params.push(start_date, end_date);
      } else if (start_date) {
        query += ` AND ${deliveryDateExpr} >= ?`;
        params.push(start_date);
      } else if (!status) {
        const statusPlaceholders = openStatuses.map(() => '?').join(',');
        query += ` AND (${deliveryDateExpr} = CURDATE() OR d.status IN (${statusPlaceholders}))`;
        params.push(...openStatuses);
      }
    } else { // Para ADMIN e SUPERVISOR
      // Se houver filtro de data, aplica. Senão, por padrão, mostra apenas as de hoje.
      if (start_date && end_date) {
        query += ` AND ${deliveryDateExpr} BETWEEN ? AND ?`;
        params.push(start_date, end_date);
      } else if (start_date) {
        query += ` AND ${deliveryDateExpr} >= ?`;
        params.push(start_date);
      } else if (end_date) {
        query += ` AND ${deliveryDateExpr} <= ?`;
        params.push(end_date);
      } else if (!status) { // Só aplica o filtro de hoje se não houver filtro de status
        query += ` AND ${deliveryDateExpr} = CURDATE()`;
      }
    }

    query += ' ORDER BY d.created_at ASC';

    console.log('[Deliveries] GET /api/deliveries - executing query', { query, params });

    const [rows] = await pool.query(query, params);

    const normalizedRows = Array.isArray(rows)
      ? rows.map((row) => ({
          ...row,
          has_receipt: Boolean(row.has_receipt),
        }))
      : rows;

    console.log('[Deliveries] GET /api/deliveries - result', { rowCount: Array.isArray(rows) ? rows.length : 'unknown' });

    res.json({
      success: true,
      data: normalizedRows,
    });
  } catch (error) {
    console.error('Erro ao listar entregas:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/deliveries/:id', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const deliveryId = req.params.id;

    const [rows] = await pool.query(`
      SELECT
        d.*, /* Seleciona todos os campos de delivery_notes */
        details.id as invoice_details_id, /* Renomeia o ID dos detalhes para evitar conflito */
        details.nf_data, details.remetente, details.destinatario, details.valores, details.transportadora, details.volumes, details.impostos, details.informacoes_complementares, details.raw_text, details.raw_fields, details.document_ai_confidence, details.document_ai_entities,
        u.full_name as driver_name,
        c.name as client_name,
        c.address as client_address,
        c.phone as client_phone,
        dr.id as receipt_id,
        dr.image_url as receipt_image_url,
        dr.status as receipt_status,
        dr.gcs_path as receipt_gcs_path,
        d.id as delivery_id /* Garante que o ID da entrega (delivery_notes.id) seja o principal e renomeia para clareza */
      FROM delivery_notes d
      LEFT JOIN delivery_invoice_details details ON d.id = details.delivery_note_id
      LEFT JOIN users u ON d.driver_id = u.id
      LEFT JOIN clients c ON d.client_id = c.id
      LEFT JOIN delivery_receipts dr ON dr.delivery_note_id = d.id
      WHERE d.id = ? AND d.company_id = ?
    `, [deliveryId, req.user.company_id]);

    if (rows.length === 0) {
      return res.status(404).json({ error: 'Entrega não encontrada' });
    }

    const delivery = rows[0];
    delivery.has_receipt = Boolean(delivery.receipt_id);

    // A consulta principal já busca todos os dados necessários das tabelas // Corrigido
    // delivery_notes e delivery_invoice_details. A busca por 'itens_de_linha' foi removida pois a tabela não existe no schema principal. // Corrigido

    const [occurrences] = await pool.query(
      'SELECT * FROM delivery_occurrences WHERE delivery_id = ? ORDER BY created_at DESC',
      [deliveryId]
    );

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

app.delete('/api/deliveries/:id', authorize(['ADMIN', 'SUPERVISOR', 'DRIVER']), async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const companyId = req.user.company_id;
    const userType = (req.user.user_type || req.user.role || '').toUpperCase();

    const [deliveryRows] = await pool.query(
      'SELECT id, driver_id, created_by_user_id, status, nf_number FROM delivery_notes WHERE id = ? AND company_id = ?',
      [deliveryId, companyId]
    );

    if (deliveryRows.length === 0) {
      return res.status(404).json({ error: 'Entrega não encontrada' });
    }

    const delivery = deliveryRows[0];

    let driverName = null;
    if (delivery.driver_id) {
      try {
        const [driverInfo] = await pool.query(
          `SELECT COALESCE(u.full_name, u.username, u.email, d.name) AS driver_name
            FROM drivers d
            LEFT JOIN users u ON d.user_id = u.id
           WHERE d.id = ? LIMIT 1`,
          [delivery.driver_id]
        );
        if (Array.isArray(driverInfo) && driverInfo.length > 0) {
          driverName = driverInfo[0].driver_name ? String(driverInfo[0].driver_name) : null;
        }
      } catch (infoError) {
        console.warn('[Deliveries] Não foi possível identificar o motorista da entrega:', infoError.message);
      }
    }

    const normalizedStatus = (delivery.status || '').toString().toUpperCase();
    const completedStatuses = new Set(['DELIVERED', 'REALIZADA', 'COMPLETED', 'FINALIZADA']);

    if (completedStatuses.has(normalizedStatus)) {
      return res.status(400).json({ error: 'Entregas concluídas não podem ser excluídas.' });
    }

    if (userType === 'DRIVER' || userType === 'MOTORISTA') {
      const driverTokenId = req.user.user_id ?? req.user.id;
      const driverIdentifiers = await findDriverIdentifiers(driverTokenId, companyId);
      const allowedIds = new Set(
        [driverTokenId, driverIdentifiers && driverIdentifiers.id, driverIdentifiers && driverIdentifiers.user_id]
          .filter((value) => value !== null && value !== undefined)
          .map((value) => value.toString())
      );

      const deliveryDriverId = delivery.driver_id !== null && delivery.driver_id !== undefined
        ? delivery.driver_id.toString()
        : null;
      const createdById = delivery.created_by_user_id !== null && delivery.created_by_user_id !== undefined
        ? delivery.created_by_user_id.toString()
        : null;

      const ownsDelivery =
        (deliveryDriverId && allowedIds.has(deliveryDriverId)) ||
        (createdById && allowedIds.has(createdById));

      if (!ownsDelivery) {
        return res.status(403).json({ error: 'Você só pode excluir entregas atribuídas a você.' });
      }
    }

    const [receiptRows] = await pool.query(
      'SELECT id FROM delivery_receipts WHERE delivery_note_id = ? LIMIT 1',
      [deliveryId]
    );
    if (Array.isArray(receiptRows) && receiptRows.length > 0) {
      return res.status(400).json({ error: 'Remova o comprovante antes de excluir a entrega.' });
    }

    await pool.query('DELETE FROM delivery_occurrences WHERE delivery_id = ?', [deliveryId]);
    await pool.query('DELETE FROM route_deliveries WHERE delivery_note_id = ?', [deliveryId]);
    await pool.query('DELETE FROM tracking_points WHERE delivery_id = ?', [deliveryId]);

    await pool.query('DELETE FROM delivery_notes WHERE id = ? AND company_id = ?', [deliveryId, companyId]);

    const actorIdRaw = req.user?.user_id ?? req.user?.id ?? null;
    const actorName =
      (typeof req.user?.full_name === 'string' && req.user.full_name) ||
      (typeof req.user?.name === 'string' && req.user.name) ||
      (typeof req.user?.username === 'string' && req.user.username) ||
      (typeof req.user?.email === 'string' && req.user.email) ||
      driverName ||
      'Motorista';

    const isDriverActor = userType === 'DRIVER' || userType === 'MOTORISTA';

    await pushDeliveryAlert({
      type: 'delivery_deleted',
      severity: 'danger',
      message: isDriverActor ? 'Entrega removida pelo motorista.' : 'Entrega removida.',
      companyId: companyId ? String(companyId) : null,
      deliveryId: String(deliveryId),
      nfNumber: delivery.nf_number ? String(delivery.nf_number) : null,
      driverId: delivery.driver_id ? String(delivery.driver_id) : null,
      driverName: driverName || 'Motorista',
      actorId: actorIdRaw ? String(actorIdRaw) : null,
      actorName,
      actorRole: userType,
      timestamp: new Date().toISOString(),
    });

    res.json({ success: true, message: 'Entrega excluída com sucesso.' });
  } catch (error) {
    console.error('Erro ao excluir entrega:', error);
    res.status(500).json({ error: error.message });
  }
});


app.get('/api/deliveries/recent-alerts', authorize(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const companyId = req.user?.company_id ? String(req.user.company_id) : null;
    const params = [companyId];
    let query = `
      SELECT alert_identifier, title, description, severity, occurred_at,
             nf_number, driver_name, vehicle_label, actor_name, message
        FROM delivery_alerts
    `;

    if (companyId) {
      query += ' WHERE company_id = ?';
    } else {
      // Se não houver companyId (improvável para ADMIN/SUPERVISOR), não retorna nada.
      return res.json({ success: true, data: [] });
    }

    query += ' ORDER BY occurred_at DESC, id DESC LIMIT 20';

    const [rows] = await pool.query(query, params);

    if (Array.isArray(rows)) {
      const alerts = rows.map((row) => {
        const severity = typeof row.severity === 'string' ? row.severity.toLowerCase() : 'info';
        const normalizedSeverity = severity === 'danger' || severity === 'warning' ? severity : 'info';
        return {
          id: row.alert_identifier || `alert-${row.id}`,
          title: row.title || 'Alerta operacional',
          description: row.description || '',
          severity: normalizedSeverity,
          timestamp: row.occurred_at ? new Date(row.occurred_at).toISOString() : new Date().toISOString(),
          // Adiciona os campos que faltavam para o frontend
          nfNumber: row.nf_number,
          driverName: row.driver_name,
          vehicleLabel: row.vehicle_label,
          actorName: row.actor_name,
          message: row.message,
        };
      });

      return res.json({ success: true, data: alerts });
    }

    return res.json({ success: true, data: [] });
  } catch (error) {
    console.error('Erro ao obter alertas recentes:', error);
    res.status(500).json({ success: false, error: 'Erro ao buscar alertas.' });
  }
});

app.put('/api/deliveries/:id/status', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { status, notes } = req.body;

    const [deliveryRows] = await pool.query(
      'SELECT * FROM delivery_notes WHERE id = ? AND company_id = ?',
      [deliveryId, req.user.company_id]
    );

    if (deliveryRows.length === 0) {
      return res.status(404).json({ error: 'Entrega não encontrada' });
    }

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
  // ✅ Prioriza a variável PORT do ambiente de produção (Railway).
  const PORT = Number(process.env.PORT || process.env.DELIVERIES_SERVICE_PORT || process.env.DELIVERIES_PORT || 3003);
  const allowedOrigins = Array.from(new Set(whitelist.map(p => p.toString())));
  app.listen(PORT, () => {
    console.log(`🔒 CORS configurado para as origens: [ // Corrigido
  ${allowedOrigins.map((origin) => `'${origin}'`).join(',\n  ')}
]`);
    console.log(`🚀 Deliveries & Routes Service rodando na porta ${PORT}`);
  });
}

module.exports = app;
