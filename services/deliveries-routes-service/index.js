require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const xml2js = require('xml2js');
const mammoth = require('mammoth');
const pdfParse = require('pdf-parse');
const { DocumentProcessorServiceClient } = require('@google-cloud/documentai');
const { Storage } = require('@google-cloud/storage');

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
      const decoded = jwt.verify(token, jwtSecret);
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


// Centralizar a inicializa��o dos clientes do Google Cloud
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
      console.log('? Google Cloud Storage configurado com sucesso');
    }
  } catch (error) {
    console.warn('?? Erro ao configurar Google Cloud Services:', error.message);
    console.warn('?? Usando armazenamento local como fallback.');
  }
} else {
  console.warn('?? Google Cloud Storage n�o configurado. Usando armazenamento local.');
}

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Deliveries & Routes',
    version: '1.0.0',
    description: 'API para gest�o de entregas, rotas e ocorr�ncias'
  }
};

const options = {
  swaggerDefinition,
  apis: ['./index.js'],
};

const swaggerSpec = swaggerJsdoc(options);

const app = express();
app.use(express.json());
app.use(cors({ origin: ['http://localhost:8080', 'http://localhost:8081'], credentials: true }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
const frontendURL = process.env.FRONTEND_URL || 'http://localhost:5173';
// Configuração do Multer para upload de arquivos em memória
const memoryUpload = multer({ storage: multer.memoryStorage() });


// Fun��o para enviar arquivo ao Google Cloud Storage
async function uploadToGCS(file, folder = 'receipts') {
  if (!file) {
    throw new Error('Arquivo n�o fornecido para upload.');
  }

  // Se o bucket n�o estiver configurado, salva localmente
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
      reject(new Error('Arquivo inv�lido: nem buffer nem path foram fornecidos'));
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
      /n[ºo]\s*(?:da\s*)?nota\s*fiscal[:\-\s]*([0-9]{1,9})/i,
      /n[ºo]\s*[:\-]?\s*(\d{1,9})\s*\/\s*s[eé]rie/i,
      /n[ºo]\s*nf[:\-\s]*([0-9]{1,9})/i,
      /n\.?\s*nf-?e?\s*[:\-\s]*([0-9]{1,9})/i,
      /nfe\s*n[ºo]\.?\s*[:\-\s]*(\d{1,9})/i,
      /nro\.?\s*(\d{1,9})\s*s[eé]rie/i,
      /nf-e\s*s[eé]rie[:\-\s]*\d+\s*n[ºo]\.?[:\-\s]*(\d{1,9})/i
    ];

    let nfNumber = '';
    for (const r of nfRegexes) {
      const m = text.match(r);
      if (m) { nfNumber = m[1]; break; }
    }

    const serieRegexes = [
      /s[eé]rie[:\-\s]*([0-9A-Za-z\-]{1,5})/i,
      /nf-e\s*s[eé]rie[:\-\s]*([0-9A-Za-z\-]{1,5})/i
    ];

    let serie = '';
    for (const r of serieRegexes) {
      const m = text.match(r);
      if (m) { serie = m[1]; break; }
    }

    const emitenteRegexes = [
      /emitente[:\-\s]*([^\n\r]{3,120})/i,
      /raz[aã]o\s*social[:\-\s]*([^\n\r]{3,120})/i,
      /nome\s*\/\s*raz[aã]o\s*social[:\-\s]*([^\n\r]{3,120})/i
    ];

    let xNomeEmit = '';
    for (const r of emitenteRegexes) {
      const m = text.match(r);
      if (m) { xNomeEmit = clean(m[1]); break; }
    }

    const destRegexes = [
      /destinat[aá]rio[:\-\s]*([^\n\r]{3,120})/i,
      /nome\s*do\s*destinat[aá]rio[:\-\s]*([^\n\r]{3,120})/i,
      /destinat[aá]rio\s*\/\s*remetente[:\-\s]*nome\s*\/\s*raz[aã]o\s*social[:\-\s]*([^\n\r]{3,120})/i
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
      /endere[çc]o[:\-\s]*([^\n\r]{3,120})/i,
      /logradouro[:\-\s]*([^\n\r]{3,120})/i
    ];

    let endereco = '';
    for (const r of enderecoRegexes) {
      const m = text.match(r);
      if (m) { endereco = clean(m[1]); break; }
    }

    const cepMatch = text.match(/CEP[:\-\s]*([0-9]{5}-?[0-9]{3})/i);
    const cep = cepMatch ? cepMatch[1] : '';

    const municipioMatch = text.match(/munic[íi]pio[:\-\s]*([^\n\r]{3,50})/i);
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

    const pesoLiquidoMatch = text.match(/peso\s*l[íi]quido[:\-\s]*([0-9\.,]{1,10})/i);
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
  // Esta função agora apenas define as queries, a execução pode ser implementada se necessário.
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
      return res.status(404).json({ error: 'Ocorr�ncia n�o encontrada' });
    }

    const delivery = rows[0];

    res.json({
      success: true,
      data: delivery
    });

  } catch (error) {
    console.error('Erro ao obter ocorr�ncia:', error);
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
      return res.status(404).json({ error: 'Ocorr�ncia n�o encontrada' });
    }

    const occurrence = rows[0];

    if (!occurrence.photo_url) {
      return res.status(404).json({ error: 'Foto n�o encontrada' });
    }

    if (!fs.existsSync(occurrence.photo_url)) {
      return res.status(404).json({ error: 'Arquivo n�o encontrado' });
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
        return res.status(400).json({ success: false, error: 'Formato de arquivo nao suportado. Envie XML, PDF ou imagem.' });
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
      return res.status(400).json({ success: false, error: 'Nao foi possivel identificar o numero da nota fiscal.' });
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
      parseDateValue(summaryPayload && summaryPayload.delivery_date_expected)
    );

    const newDelivery = {
      company_id,
      nf_number: nfNumber,
      client_name_extracted: clientName || null,
      delivery_address: clientAddress || null,
      merchandise_value: typeof merchandiseValue === 'number' ? merchandiseValue : 0,
      delivery_volume: deliveryVolume,
      status: requestedStatus || 'PENDING',
      created_by_user_id: userId,
      // Ensure created_at is populated so server-side DATE(...) filters that
      // check CURDATE() will match newly created deliveries.
      created_at: new Date(),
      emission_date: emissionDate || null,
      nfe_key: nfKey || null,
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
      return res.status(409).json({ success: false, error: 'Uma entrega com este numero de NF-e ja existe.' });
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
        c.name as client_name,
        c.address as client_address,
        dr.id AS receipt_id,
        dr.image_url AS receipt_image_url,
        CASE WHEN dr.id IS NOT NULL THEN 1 ELSE 0 END AS has_receipt
      FROM delivery_notes d
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
      query += ' AND (d.driver_id = ?';
      params.push(driverUserId);
      const driverRecordId = driverRowFromToken && driverRowFromToken.id ? String(driverRowFromToken.id) : null;
      if (driverRecordId && driverRecordId !== driverUserId) {
        query += ' OR d.driver_id = ?';
        params.push(driverRecordId);
      }
      query += ')';
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

    const deliveryDateExpr = 'DATE(COALESCE(d.delivery_date_expected, d.created_at))';

    // Se o usuário é um motorista e não há filtro de data, mostramos todas as pendentes/em andamento.
    if ((user.user_type === 'DRIVER' || user.user_type === 'MOTORISTA') && !start_date && !end_date && !status) {
      query += ` AND (${deliveryDateExpr} = CURDATE() OR UPPER(d.status) IN ('PENDING', 'IN_TRANSIT', 'PENDENTE', 'EM_ANDAMENTO'))`;
    } else if (status) {
      // Se um status é fornecido, aplica o filtro para qualquer tipo de usuário
      query += ' AND d.status = ?';
      params.push(status);
    } else {
      // Para outros usuários ou quando há filtro de data, mantém a lógica original.
      if (start_date && end_date) {
        query += ' AND ' + deliveryDateExpr + ' >= ? AND ' + deliveryDateExpr + ' <= ?';
        params.push(start_date, end_date);
      } else if (start_date) {
        query += ' AND ' + deliveryDateExpr + ' >= ?';
        params.push(start_date);
      } else if (end_date) {
        query += ' AND ' + deliveryDateExpr + ' <= ?';
        params.push(end_date);
      } else {
        query += ' AND ' + deliveryDateExpr + ' = CURDATE()';
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
      return res.status(404).json({ error: 'Entrega n�o encontrada' });
    }

    const delivery = rows[0];
    delivery.has_receipt = Boolean(delivery.receipt_id);

    // A consulta principal já busca todos os dados necessários das tabelas
    // delivery_notes e delivery_invoice_details. A busca por 'itens_de_linha' foi removida pois a tabela não existe no schema principal.

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

app.put('/api/deliveries/:id/status', authorize(['DRIVER', 'ADMIN', 'SUPERVISOR']), async (req, res) => {
  try {
    const deliveryId = req.params.id;
    const { status, notes } = req.body;

    const [deliveryRows] = await pool.query(
      'SELECT * FROM delivery_notes WHERE id = ? AND company_id = ?',
      [deliveryId, req.user.company_id]
    );

    if (deliveryRows.length === 0) {
      return res.status(404).json({ error: 'Entrega n�o encontrada' });
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
  const PORT = Number(process.env.DELIVERIES_SERVICE_PORT || process.env.DELIVERIES_PORT || process.env.PORT || 3003);
  app.listen(PORT, () => console.log(`Deliveries & Routes Service rodando na porta ${PORT}`));
}

module.exports = app;
