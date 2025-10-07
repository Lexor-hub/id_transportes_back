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
    const [rows] = await pool.query('SELECT * FROM drivers');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
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
  const PORT = Number(process.env.PORT ?? 3002);
  app.listen(PORT, () => console.log(`Drivers/Vehicles Service rodando na porta ${PORT}`));
}
module.exports = app;
