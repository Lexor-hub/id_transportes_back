const express = require('express');
const pool = require('../../shared/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const cors = require('cors');
require('dotenv').config();
// Debug: verificar se JWT_SECRET está carregado
console.log('🔑 Debug - JWT_SECRET:', process.env.JWT_SECRET ? 'DEFINIDO' : 'NÃO DEFINIDO');
if (process.env.JWT_SECRET) {
  console.log('🔑 Debug - JWT_SECRET (primeiros 10 chars):', process.env.JWT_SECRET.substring(0, 10) + '...');
}
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Auth/Users',
    version: '1.0.0',
    description: 'Documentação da API de autenticação e usuários'
  }
};
const options = {
  swaggerDefinition,
  apis: ['./index.js'],
};
const swaggerSpec = swaggerJsdoc(options);
const app = express();
const AUTH_USERS_PORT = Number(
  process.env.NODE_ENV === 'production'
    ? (process.env.PORT || 3001) // Em produção (Railway), usa a porta do ambiente.
    : (process.env.AUTH_USERS_SERVICE_PORT || process.env.AUTH_USERS_PORT || 3001) // Localmente, usa a porta específica.
);

const runWithRetry = async (sql, params = []) => {
  if (typeof pool.executeWithRetry === 'function') {
    const [rows] = await pool.executeWithRetry(sql, params);
    return rows;
  }
  const [rows] = await pool.query(sql, params);
  return rows;
};
async function ensureUserTableColumns() {
  try {
    const cpfColumn = await runWithRetry("SHOW COLUMNS FROM users LIKE 'cpf'");
    if (!Array.isArray(cpfColumn) || !cpfColumn.length) {
      await runWithRetry("ALTER TABLE users ADD COLUMN cpf VARCHAR(14) NULL AFTER full_name");
      console.log('🛠️ Coluna cpf adicionada à tabela users');
    }
    const statusColumn = await runWithRetry("SHOW COLUMNS FROM users LIKE 'status'");
    if (!Array.isArray(statusColumn) || !statusColumn.length) {
      await runWithRetry("ALTER TABLE users ADD COLUMN status ENUM('ATIVO','INATIVO') NOT NULL DEFAULT 'ATIVO' AFTER user_type");
      await runWithRetry("UPDATE users SET status = CASE WHEN is_active = 1 THEN 'ATIVO' ELSE 'INATIVO' END");
      console.log('🛠️ Coluna status adicionada à tabela users');
    }
  } catch (error) {
    console.error('Erro ao garantir colunas da tabela users:', error);
    throw error;
  }
}
const ensureUserColumnsPromise = ensureUserTableColumns().catch(error => {
  console.error('Falha ao preparar colunas da tabela users:', error);
  console.error('Prosseguindo sem alterações automáticas de schema. Verifique a base de dados.');
  return false;
});
app.use(express.json());

// Lista de origens permitidas locais e configuráveis via ambiente
const defaultOrigins = [
  'http://localhost:8080',
  'http://localhost:5173',
  'http://localhost:8081',
  'http://127.0.0.1:8080',
  'http://127.0.0.1:8081',
];

const allowedOriginPatterns = [
  /^https:\/\/transportes-.*\.vercel\.app$/,
  /^https:\/\/idtransportes-.*\.vercel\.app$/,
  /^https:\/\/trasportes-.*\.vercel\.app$/, // Adicionado para corrigir o nome do projeto Vercel
];

const whitelist = [...defaultOrigins, ...allowedOriginPatterns];

const corsOptions = {
  origin: (origin, callback) => {
    // Permite requisições sem 'origin' (ex: Postman, apps mobile)
    if (!origin) return callback(null, true);

    // Verifica se a origem está na lista de permissões (strings exatas ou regex)
    const isAllowed = whitelist.some(pattern =>
      (pattern instanceof RegExp) ? pattern.test(origin) : pattern === origin
    );

    if (isAllowed) {
      callback(null, true);
    } else {
      console.error(`[Auth-Users CORS] Origin '${origin}' not allowed.`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));


// Servir arquivos estáticos (como o manifest) ANTES de qualquer rota de API
// Isso evita que o middleware de autenticação bloqueie o acesso a eles.
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
// Health check (useful to verify the service is reachable during development)
app.get('/_health', (req, res) => {
  res.json({ status: 'ok', service: 'auth-users-service' });
});
/**
 * @swagger
 * /api/auth/login:
 *   post: // Corrigido
 *     summary: Login de usuÃ¡rio
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Token JWT
 */
// Login
app.post('/api/auth/login', async (req, res) => {
  const { username, password, company_domain } = req.body;
  try {
    // Se fornecido company_domain, buscar empresa primeiro
    let companyId = null;
    if (company_domain) {
      const [companyRows] = await pool.query('SELECT id FROM companies WHERE domain = ? AND is_active = 1', [company_domain]);
      if (companyRows.length === 0) {
        return res.status(401).json({ error: 'Empresa não encontrada ou inativa' });
      }
      companyId = companyRows[0].id;
    }
    // Buscar usuÃ¡rio com ou sem filtro de empresa
    let query = 'SELECT u.*, c.name as company_name, c.domain as company_domain FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.username = ?';
    let params = [username];
    if (companyId) {
      query += ' AND u.company_id = ?';
      params.push(companyId);
    }
    const [rows] = await pool.query(query, params);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    if (!user.is_active) return res.status(401).json({ error: 'UsuÃ¡rio inativo' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Senha inválida' });
    // Atualizar Ãºltimo login
    await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
    // Debug: verificar JWT_SECRET antes de gerar token
    console.log('🔑 Debug - Gerando token para usuário:', user.username);
    console.log('🔑 Debug - JWT_SECRET disponível:', !!process.env.JWT_SECRET);
    const token = jwt.sign({ 
      id: user.id, 
      user_type: user.user_type, 
      company_id: user.company_id 
    }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Montar objeto user sem o hash da senha
    const userResponse = {
      id: user.id,
      username: user.username,
      name: user.full_name,
      email: user.email,
      role: user.user_type,
      company_id: user.company_id,
      company_name: user.company_name,
      company_domain: user.company_domain,
      is_active: user.is_active,
      last_login: user.last_login,
      created_at: user.created_at,
      updated_at: user.updated_at
    };
    res.json({ user: userResponse, token });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Middleware de autenticação e autorização
function authorize(roles = []) {
  return (req, res, next) => {
    const auth = req.headers.authorization;
    if (!auth) return res.status(401).json({ error: 'Token não fornecido' });
    const token = auth.split(' ')[1];
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
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
// Middleware para verificar acesso Ã  empresa (exceto para MASTER)
function checkCompanyAccess() {
  return (req, res, next) => {
    if (req.user.user_type === 'MASTER') {
      return next();
    }
    const companyId = req.params.company_id || req.body.company_id;
    if (companyId && req.user.company_id != companyId) {
      return res.status(403).json({ error: 'Acesso negado a esta empresa' });
    }
    next();
  };
}
// Recuperação de senha (simulado)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { username } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    // Aqui você geraria um token e enviaria por e-mail
    // Exemplo: const token = crypto.randomBytes(20).toString('hex');
    res.json({ message: 'InstruÃ§Ãµes de recuperaÃ§Ã£o enviadas (simulado)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/auth/companies:
 *   get:
 *     summary: Lista as empresas associadas a um usuário
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lista de empresas
 *       401:
 *         description: Token inválido ou não fornecido
 */
app.get('/api/auth/companies', authorize(), async (req, res) => {
  try {
    const { id: userId, user_type: userType, company_id: userCompanyId } = req.user;
    let companies = [];

    if (userType === 'MASTER') {
      // Usuário MASTER pode ver todas as empresas ativas
      console.log('🏢 Buscando todas as empresas para usuário MASTER...');
      const [allCompanies] = await pool.query(
        'SELECT id, name, domain, logo_url FROM companies WHERE is_active = 1'
      );
      companies = allCompanies;
    } else {
      // Outros usuários veem apenas a própria empresa
      console.log(`🏢 Buscando empresa (ID: ${userCompanyId}) para usuário padrão...`);
      const [userCompany] = await pool.query('SELECT id, name, domain, logo_url FROM companies WHERE id = ? AND is_active = 1', [userCompanyId]);
      companies = userCompany;
    }
    res.json({ success: true, data: companies });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/auth/select-company:
 *   post:
 *     summary: Seleciona uma empresa para o usuário e retorna um novo token
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               company_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Novo token JWT com a empresa selecionada
 *       401:
 *         description: Token inválido ou não fornecido
 *       403:
 *         description: Acesso negado à empresa solicitada
 */
app.post('/api/auth/select-company', authorize(), async (req, res) => {
  const { company_id: selectedCompanyId } = req.body;
  const { id: userId, user_type: userType } = req.user;

  if (!selectedCompanyId) {
    return res.status(400).json({ success: false, error: 'O ID da empresa é obrigatório.' });
  }

  try {
    // 1. Validar se o usuário tem acesso à empresa solicitada
    if (userType !== 'MASTER') {
      const [userRows] = await pool.query('SELECT company_id FROM users WHERE id = ?', [userId]);
      if (userRows.length === 0 || userRows[0].company_id !== selectedCompanyId) {
        return res.status(403).json({ success: false, error: 'Acesso negado a esta empresa.' });
      }
    }

    // 2. Buscar os dados completos do usuário e da empresa para gerar o novo token e a resposta
    const [rows] = await pool.query(
      'SELECT u.*, c.name as company_name, c.domain as company_domain FROM users u LEFT JOIN companies c ON u.company_id = c.id WHERE u.id = ?',
      [userId]
    );
    const user = rows[0];

    // ✅ ADICIONADO: Verificação para garantir que o usuário foi encontrado
    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuário não encontrado durante a geração do token final.' });
    }

    // 3. Gerar o novo token JWT com o company_id final
    const finalToken = jwt.sign(
      { id: user.id, user_type: user.user_type, company_id: selectedCompanyId },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    // Remover o hash da senha da resposta
    delete user.password_hash;

    res.json({ success: true, data: { token: finalToken, user } });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Listar usuários (apenas ADMIN e MASTER)
app.get('/api/users', authorize(['ADMIN', 'MASTER']), async (req, res) => {
  try {
    let query = `
      SELECT u.id, u.username, u.email, u.full_name, u.user_type, u.is_active,
             u.cpf, u.company_id, COALESCE(u.status, CASE WHEN u.is_active = 1 THEN 'ATIVO' ELSE 'INATIVO' END) AS status,
             u.last_login, u.created_at, u.updated_at, c.name as company_name
      FROM users u
      LEFT JOIN companies c ON u.company_id = c.id
    `;
    let params = [];
    let whereConditions = [];
    // Se não for MASTER, filtrar apenas usuários da empresa
    if (req.user.user_type !== 'MASTER') {
      whereConditions.push('u.company_id = ?');
      params.push(req.user.company_id);
    }
    // 🔒 PROTEÇÃO: Ocultar usuário master para usuários não-master
    // Apenas usuários MASTER podem ver outros usuários MASTER
    if (req.user.user_type !== 'MASTER') {
      whereConditions.push("u.user_type != 'MASTER'");
    }
    // Adicionar condições WHERE se existirem
    if (whereConditions.length > 0) {
      query += ' WHERE ' + whereConditions.join(' AND ');
    }
    query += ' ORDER BY u.created_at DESC';
    const [rows] = await pool.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Cadastro de usuário (apenas ADMIN e MASTER)
app.post('/api/users', authorize(['ADMIN', 'MASTER', 'SUPERVISOR']), async (req, res) => {
  const { username, password, email, full_name, user_type, company_id, cpf, status } = req.body;
  // 🔒 VALIDAÇÃO DE PERMISSÕES: Verificar se o usuário pode criar o tipo solicitado
  const allowedUserTypes = {
    'MASTER': ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT'], // Master pode criar qualquer tipo
    'ADMIN': ['SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT'], // Admin nÃ£o pode criar MASTER nem ADMIN
    'SUPERVISOR': ['OPERATOR', 'DRIVER'] // Supervisor sÃ³ pode criar OPERATOR e DRIVER
  };
  const userAllowedTypes = allowedUserTypes[req.user.user_type] || [];
  if (!userAllowedTypes.includes(user_type)) {
    return res.status(403).json({ 
      error: `Você não tem permissão para criar usuários do tipo ${user_type}. Tipos permitidos: ${userAllowedTypes.join(', ')}` 
    });
  }
  // Determinar company_id
  let targetCompanyId = company_id;
  if (req.user.user_type !== 'MASTER') {
    targetCompanyId = req.user.company_id;
  }
  if (!targetCompanyId) {
    return res.status(400).json({ error: 'Company ID é obrigatório' });
  }
  // Validação de senha forte
  if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.' });
  }
  const normalizedStatus = typeof status === 'string' && status.trim().toUpperCase() === 'INATIVO' ? 'INATIVO' : 'ATIVO';
  const isActiveFlag = normalizedStatus === 'ATIVO';
  const sanitizedCpfDigits = cpf ? cpf.toString().replace(/\D/g, '').slice(0, 14) : '';
  const sanitizedCpf = sanitizedCpfDigits ? sanitizedCpfDigits : null;
  // Validação de username único por empresa
  const [exists] = await pool.query('SELECT id FROM users WHERE username = ? AND company_id = ?', [username, targetCompanyId]);
  if (exists.length > 0) return res.status(400).json({ error: 'Username jÃ¡ cadastrado nesta empresa' });
  const hash = await bcrypt.hash(password, 10);
  try {
    const [result] = await pool.query(
      'INSERT INTO users (username, password_hash, email, full_name, user_type, company_id, cpf, status, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [username, hash, email, full_name, user_type, targetCompanyId, sanitizedCpf, normalizedStatus, isActiveFlag]
    );
    const insertId = result && result.insertId ? result.insertId : null;
    // Return the created user's id to help clients create related records (e.g. drivers)
    return res.status(201).json({ success: true, data: { id: insertId, username, company_id: targetCompanyId } });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// Troca de senha
app.put('/api/users/:id/password', authorize(), async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8 || !/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return res.status(400).json({ error: 'A nova senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.' });
  }
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    const user = rows[0];
    const valid = await bcrypt.compare(oldPassword, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Senha atual incorreta' });
    const hash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash=? WHERE id=?', [hash, req.params.id]);
    res.json({ message: 'Senha alterada com sucesso' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Atualizar usuário
app.put('/api/users/:id', authorize(['ADMIN', 'MASTER', 'SUPERVISOR']), async (req, res) => {
  const { email, full_name, user_type, is_active, cpf, status } = req.body;
  try {
    // 🔒 PROTEÇÃO: Verificar se está tentando editar um usuário MASTER
    const [targetUser] = await pool.query('SELECT user_type, username, is_active, status FROM users WHERE id = ?', [req.params.id]);
    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    // Apenas usuÃ¡rios MASTER podem editar outros usuÃ¡rios MASTER
    if (targetUser[0].user_type === 'MASTER' && req.user.user_type !== 'MASTER') {
      return res.status(403).json({ 
        error: 'Acesso negado: Apenas usuÃ¡rios MASTER podem editar outros usuÃ¡rios MASTER',
        details: 'OperaÃ§Ã£o nÃ£o permitida por questÃµes de seguranÃ§a'
      });
    }
    // 🔒 VALIDAÇÃO DE PERMISSÕES: Verificar se o usuário pode alterar para o tipo solicitado
    if (user_type && user_type !== targetUser[0].user_type) {
      const allowedUserTypes = {
        'MASTER': ['ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT'], // Master pode alterar para qualquer tipo
        'ADMIN': ['SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT'], // Admin nÃ£o pode criar MASTER nem ADMIN
        'SUPERVISOR': ['OPERATOR', 'DRIVER'] // Supervisor sÃ³ pode alterar para OPERATOR e DRIVER
      };
      const userAllowedTypes = allowedUserTypes[req.user.user_type] || [];
      if (!userAllowedTypes.includes(user_type)) {
        return res.status(403).json({ 
          error: `Você não tem permissão para alterar usuários para o tipo ${user_type}. Tipos permitidos: ${userAllowedTypes.join(', ')}` 
        });
      }
    }
    // 🔒 PROTEÇÃO: Impedir que usuários não-MASTER alterem o tipo de usuário para MASTER
    if (user_type === 'MASTER' && req.user.user_type !== 'MASTER') {
      return res.status(403).json({ 
        error: 'Acesso negado: Apenas usuários MASTER podem criar outros usuários MASTER',
        details: 'Não é possível alterar o tipo de usuário para MASTER'
      });
    }
    const currentTarget = targetUser[0];
    const normalizedStatus = (() => {
      if (typeof status === 'string') {
        const upper = status.trim().toUpperCase();
        if (upper === 'ATIVO' || upper === 'INATIVO') {
          return upper;
        }
      }
      if (typeof is_active === 'boolean' || typeof is_active === 'number') {
        return is_active ? 'ATIVO' : 'INATIVO';
      }
      if (typeof is_active === 'string') {
        const normalized = is_active.trim().toUpperCase();
        if (normalized === 'ATIVO' || normalized === 'INATIVO') {
          return normalized;
        }
        if (normalized === '1' || normalized === 'TRUE') {
          return 'ATIVO';
        }
        if (normalized === '0' || normalized === 'FALSE') {
          return 'INATIVO';
        }
      }
      if (currentTarget.status) {
        const upper = currentTarget.status.toUpperCase();
        if (upper === 'ATIVO' || upper === 'INATIVO') {
          return upper;
        }
      }
      return currentTarget.is_active ? 'ATIVO' : 'INATIVO';
    })();
    const isActiveFlag = normalizedStatus === 'ATIVO';
    const sanitizedCpfDigits = cpf ? cpf.toString().replace(/\D/g, '').slice(0, 14) : '';
  const sanitizedCpf = sanitizedCpfDigits ? sanitizedCpfDigits : null;
    await pool.query(
      'UPDATE users SET email=?, full_name=?, user_type=?, cpf=?, status=?, is_active=? WHERE id=?',
      [email, full_name, user_type, sanitizedCpf, normalizedStatus, isActiveFlag, req.params.id]
    );
    res.json({ message: 'Usuário atualizado com sucesso' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
// Excluir usuário permanentemente
app.delete('/api/users/:id', authorize(['ADMIN', 'MASTER']), async (req, res) => {
  try {
    // 🔒 PROTEÇÃO: Verificar se está tentando deletar um usuário MASTER
    const [targetUser] = await pool.query('SELECT user_type, username, is_active, status FROM users WHERE id = ?', [req.params.id]);
    if (targetUser.length === 0) {
      return res.status(404).json({ error: 'Usuário não encontrado' });
    }
    // Apenas usuÃ¡rios MASTER podem deletar outros usuÃ¡rios MASTER
    if (targetUser[0].user_type === 'MASTER' && req.user.user_type !== 'MASTER') {
      return res.status(403).json({ 
        error: 'Acesso negado: Apenas usuÃ¡rios MASTER podem deletar outros usuÃ¡rios MASTER',
        details: `OperaÃ§Ã£o nÃ£o permitida para o usuÃ¡rio: ${targetUser[0].username}`
      });
    }
    // 🔒 PROTEÇÃO ADICIONAL: Impedir auto-exclusão do último usuário MASTER
    if (targetUser[0].user_type === 'MASTER') {
      const [masterCount] = await pool.query('SELECT COUNT(*) as count FROM users WHERE user_type = "MASTER" AND is_active = 1');
      if (masterCount[0].count <= 1) {
        return res.status(403).json({ 
          error: 'Operação não permitida: Não é possível deletar o último usuário MASTER do sistema',
          details: 'Deve existir pelo menos um usuÃ¡rio MASTER ativo no sistema'
        });
      }
    }
    // Excluir permanentemente do banco de dados
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ message: 'UsuÃ¡rio excluÃ­do permanentemente do sistema' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

/**
 * @swagger
 * /api/companies:
 *   get:
 *     summary: Lista todas as empresas (para gerenciamento)
 *     description: Rota para gerenciamento de empresas, acessível apenas por MASTER.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Uma lista de empresas.
 *       403:
 *         description: Acesso negado.
 */
app.get('/api/companies', authorize(['MASTER']), async (req, res) => {
  try {
    const [companies] = await pool.query(
      'SELECT id, name, domain, cnpj, is_active, subscription_plan, created_at FROM companies ORDER BY name ASC'
    );
    res.json({ success: true, data: companies });
  } catch (err) {
    console.error('Erro ao buscar empresas para gerenciamento:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

if (require.main === module) {
  ensureUserColumnsPromise
    .then((schemaReady) => {
      if (!schemaReady) {
        console.warn('Auth/Users Service iniciou sem aplicar migrações automáticas. Verifique se as colunas cpf/status existem.');
      }
      app.listen(AUTH_USERS_PORT, () => { // Corrigido
        const allowedOrigins = Array.from(new Set(whitelist.map(p => p.toString())));
        console.log(`🔒 CORS configurado para as origens: [\n  ${allowedOrigins.join(',\n  ')}\n]`);
        console.log(`🚀 Auth/Users Service rodando na porta ${AUTH_USERS_PORT}`);
      });
    }).catch((err) => {
      console.error('Auth/Users Service nÃ£o pÃ´de iniciar devido a erro de preparaÃ§Ã£o do banco:', err);
      process.exit(1);
    });
}
module.exports = app;
