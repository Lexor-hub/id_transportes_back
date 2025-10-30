const express = require('express');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());
const cors = require('cors');

const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret) {
  throw new Error('JWT_SECRET environment variable is required for Drivers/Vehicles service');
}

const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Drivers/Vehicles',
    version: '1.0.0',
    description: 'Documentação da API de motoristas e veículos'
  }
};
const options = {
  swaggerDefinition,
  apis: ['./index.js'],
};
const swaggerSpec = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use(cors({ origin: '*', credentials: true }));

let driverSchemaCache = null;
async function getDriverSchema() {
  if (driverSchemaCache) {
    return driverSchemaCache;
  }

  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'drivers'`
    );

    const columns = Array.isArray(rows) ? rows.map((row) => row.COLUMN_NAME) : [];
    driverSchemaCache = {
      hasCompanyId: columns.includes('company_id'),
      hasStatus: columns.includes('status'),
      hasName: columns.includes('name'),
    };
  } catch (error) {
    console.warn('[Drivers] Falha ao inspecionar colunas da tabela drivers. Assumindo colunas padrão.', error && error.message ? error.message : error);
    driverSchemaCache = { hasCompanyId: true, hasStatus: true, hasName: true };
  }

  return driverSchemaCache;
}

let userSchemaCache = null;
async function getUserSchema() {
  if (userSchemaCache) {
    return userSchemaCache;
  }

  try {
    const [rows] = await pool.query(
      `SELECT COLUMN_NAME
         FROM information_schema.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users'`
    );

    const columns = Array.isArray(rows) ? rows.map((row) => row.COLUMN_NAME) : [];
    userSchemaCache = {
      hasName: columns.includes('name'),
      hasFullName: columns.includes('full_name'),
      hasUsername: columns.includes('username'),
      hasEmail: columns.includes('email'),
    };
  } catch (error) {
    console.warn('[Drivers] Falha ao inspecionar colunas da tabela users. Assumindo colunas padrão.', error && error.message ? error.message : error);
    userSchemaCache = { hasName: false, hasFullName: true, hasUsername: true, hasEmail: true };
  }

  return userSchemaCache;
}

/**
 * @swagger
 * /api/drivers:
 *   get:
 *     summary: Lista todos os motoristas
 *     responses:
 *       200:
 *         description: Lista de motoristas
 */
// Middleware de autenticação e autorização
function authorize(roles = []) {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Token não fornecido' });
    const token = auth.split(' ')[1];
    try {
      const decoded = jwt.verify(token, jwtSecret);
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

// Cadastro de motorista (ADMIN/SUPERVISOR/MASTER)
app.post('/api/drivers', authorize(['ADMIN', 'SUPERVISOR', 'MASTER']), async (req, res) => {
  const { user_id, cpf, phone_number, tech_knowledge, is_outsourced, company_id: companyIdBody, companyId } = req.body;
  try {
    if (!user_id || !cpf) {
      return res.status(400).json({ error: 'user_id e cpf são obrigatórios' });
    }

    const requesterRole = req.user?.user_type;
    const requesterCompanyId = req.user?.company_id ?? null;
    const providedCompanyId = companyIdBody ?? companyId ?? null;

    let targetCompanyId = requesterCompanyId;
    if (requesterRole === 'MASTER' && providedCompanyId) {
      targetCompanyId = providedCompanyId;
    }

    if (!targetCompanyId) {
      return res.status(400).json({ error: 'company_id não informado' });
    }

    const companyIdNumber = Number(targetCompanyId);
    if (!Number.isFinite(companyIdNumber)) {
      return res.status(400).json({ error: 'company_id inválido' });
    }

    const [userRows] = await pool.query('SELECT id, company_id FROM users WHERE id = ? LIMIT 1', [user_id]);
    if (userRows.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }

    const userCompanyId = userRows[0].company_id;
    if (userCompanyId && Number(userCompanyId) !== companyIdNumber && requesterRole !== 'MASTER') {
      return res.status(403).json({ error: 'Usuário não pertence à empresa do solicitante' });
    }

    const [driverByUser] = await pool.query('SELECT id FROM drivers WHERE user_id = ?', [user_id]);
    if (driverByUser.length > 0) {
      return res.status(400).json({ error: 'Usuário já possui motorista cadastrado' });
    }

    const [driverByCpf] = await pool.query('SELECT id FROM drivers WHERE cpf = ?', [cpf]);
    if (driverByCpf.length > 0) {
      return res.status(400).json({ error: 'CPF já cadastrado' });
    }

    const normalizedIsOutsourced = typeof is_outsourced === 'boolean'
      ? (is_outsourced ? 1 : 0)
      : (is_outsourced === 0 || is_outsourced === 1 ? is_outsourced : 1);

    const [result] = await pool.query(
      'INSERT INTO drivers (user_id, company_id, cpf, phone_number, tech_knowledge, is_outsourced, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())',
      [
        user_id,
        companyIdNumber,
        cpf,
        phone_number || null,
        tech_knowledge || null,
        normalizedIsOutsourced,
        'active'
      ]
    );

    const insertId = result && result.insertId ? result.insertId : null;
    return res.status(201).json({ success: true, data: { id: insertId, user_id, company_id: companyIdNumber } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listar motoristas
app.get('/api/drivers', async (req, res) => {
  try {
    const schema = await getDriverSchema();
    const userSchema = await getUserSchema();
    const { status, company_id: companyId } = req.query;
    const conditions = [];
    const params = [];

    if (status) {
      if (schema.hasStatus) {
        conditions.push('LOWER(d.status) = ?');
        params.push(String(status).toLowerCase());
      } else {
        console.warn('[Drivers] Parâmetro "status" ignorado porque a coluna drivers.status não existe na base atual.');
      }
    }

    if (companyId) {
      const numericCompany = Number(companyId);
      if (Number.isFinite(numericCompany)) {
        const companyColumn = schema.hasCompanyId ? 'd.company_id' : 'u.company_id';
        conditions.push(`${companyColumn} = ?`);
        params.push(numericCompany);
      }
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const companySelect = schema.hasCompanyId ? 'd.company_id AS company_id' : 'u.company_id AS company_id';
    const statusSelect = schema.hasStatus ? 'd.status AS status' : `'active' AS status`;

    const nameSources = [];
    if (userSchema.hasFullName) nameSources.push('u.full_name');
    if (userSchema.hasName) nameSources.push('u.name');
    if (userSchema.hasUsername) nameSources.push('u.username');
    if (userSchema.hasEmail) nameSources.push('u.email');
    if (schema.hasName) {
      nameSources.push("NULLIF(d.name, '')");
    }
    if (nameSources.length === 0) {
      nameSources.push("CONCAT('Motorista ', d.id)");
    }
    const nameExpression = `COALESCE(${nameSources.join(', ')}, CONCAT('Motorista ', d.id))`;

    const fullNameSelect = userSchema.hasFullName ? 'u.full_name AS full_name' : 'NULL AS full_name';
    const userNameSelect = userSchema.hasName ? 'u.name AS user_name' : 'NULL AS user_name';
    const usernameSelect = userSchema.hasUsername ? 'u.username AS username' : 'NULL AS username';
    const emailSelect = userSchema.hasEmail ? 'u.email AS email' : 'NULL AS email';

    const sql = `
      SELECT
        d.id,
        d.user_id,
        ${companySelect},
        ${statusSelect},
        d.phone_number,
        d.tech_knowledge,
        d.is_outsourced,
        d.created_at,
        d.updated_at,
        ${nameExpression} AS driver_name,
        ${nameExpression} AS display_name,
        ${fullNameSelect},
        ${userNameSelect},
        ${usernameSelect},
        ${emailSelect}
      FROM drivers d
      LEFT JOIN users u ON u.id = d.user_id
      ${whereClause}
      ORDER BY driver_name ASC
    `;

    const [rows] = await pool.query(sql, params);
    res.json({ success: true, data: rows });
  } catch (err) {
    console.error('[Drivers] Erro ao listar motoristas:', err);
    res.status(500).json({ success: false, error: err?.message || 'Erro interno ao listar motoristas.' });
  }
});

// Detalhes de motorista
app.get('/api/drivers/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM drivers WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Motorista não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar motorista (ADMIN/SUPERVISOR)
app.put('/api/drivers/:id', authorize(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  const { phone_number, tech_knowledge, is_outsourced } = req.body;
  try {
    await pool.query(
      'UPDATE drivers SET phone_number=?, tech_knowledge=?, is_outsourced=? WHERE id=?',
      [phone_number, tech_knowledge, is_outsourced, req.params.id]
    );
    res.json({ message: 'Motorista atualizado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Cadastro de veículo (ADMIN/SUPERVISOR)
app.post('/api/vehicles', authorize(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  const { plate, model, year } = req.body;
  try {
    // Validação de placa única
    const [exists] = await pool.query('SELECT id FROM vehicles WHERE plate = ?', [plate]);
    if (exists.length > 0) return res.status(400).json({ error: 'Placa já cadastrada' });
    await pool.query(
      'INSERT INTO vehicles (plate, model, year) VALUES (?, ?, ?)',
      [plate, model, year]
    );
    res.status(201).json({ message: 'Veículo cadastrado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listar veículos
app.get('/api/vehicles', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vehicles');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhes de veículo
app.get('/api/vehicles/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM vehicles WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Veículo não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar veículo (ADMIN/SUPERVISOR)
app.put('/api/vehicles/:id', authorize(['ADMIN', 'SUPERVISOR']), async (req, res) => {
  const { model, year } = req.body;
  try {
    await pool.query(
      'UPDATE vehicles SET model=?, year=? WHERE id=?',
      [model, year, req.params.id]
    );
    res.json({ message: 'Veículo atualizado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

if (require.main === module) {
  const PORT = Number(process.env.DRIVERS_SERVICE_PORT || process.env.DRIVERS_PORT || process.env.PORT || 3002);
  app.listen(PORT, () => console.log(`Drivers/Vehicles Service rodando na porta ${PORT}`));
}
module.exports = app;
