const express = require('express');
const pool = require('../../shared/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
require('dotenv').config();
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');
const cors = require('cors');

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
app.use(express.json());
app.use(cors({ origin: 'http://localhost:8080', credentials: true }));
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: Login de usuário
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
  const { username, password } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    const user = rows[0];
    if (!user) return res.status(401).json({ error: 'Usuário não encontrado' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Senha inválida' });
    const token = jwt.sign({ id: user.id, user_type: user.user_type }, process.env.JWT_SECRET, { expiresIn: '1d' });
    // Montar objeto user sem o hash da senha
    const userResponse = {
      id: user.id,
      username: user.username,
      name: user.full_name,
      email: user.email,
      role: user.user_type,
      is_active: user.is_active,
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

// Recuperação de senha (simulado)
app.post('/api/auth/forgot-password', async (req, res) => {
  const { username } = req.body;
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    // Aqui você geraria um token e enviaria por e-mail
    // Exemplo: const token = crypto.randomBytes(20).toString('hex');
    res.json({ message: 'Instruções de recuperação enviadas (simulado)' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastro de usuário (apenas ADMIN)
app.post('/api/users', authorize(['ADMIN']), async (req, res) => {
  const { username, password, email, full_name, user_type } = req.body;
  // Validação de senha forte
  if (!password || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return res.status(400).json({ error: 'A senha deve ter pelo menos 8 caracteres, incluindo maiúscula, minúscula e número.' });
  }
  // Validação de username único
  const [exists] = await pool.query('SELECT id FROM users WHERE username = ?', [username]);
  if (exists.length > 0) return res.status(400).json({ error: 'Username já cadastrado' });
  const hash = await bcrypt.hash(password, 10);
  try {
    await pool.query(
      'INSERT INTO users (username, password_hash, email, full_name, user_type) VALUES (?, ?, ?, ?, ?)',
      [username, hash, email, full_name, user_type]
    );
    res.status(201).json({ message: 'Usuário criado' });
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

// Detalhes de usuário
app.get('/api/users/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Usuário não encontrado' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar usuário
app.put('/api/users/:id', async (req, res) => {
  const { email, full_name, user_type, is_active } = req.body;
  try {
    await pool.query(
      'UPDATE users SET email=?, full_name=?, user_type=?, is_active=? WHERE id=?',
      [email, full_name, user_type, is_active, req.params.id]
    );
    res.json({ message: 'Usuário atualizado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Desativar/excluir usuário
app.delete('/api/users/:id', async (req, res) => {
  try {
    await pool.query('UPDATE users SET is_active=0 WHERE id=?', [req.params.id]);
    res.json({ message: 'Usuário desativado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(3001, () => console.log('Auth/Users Service rodando na porta 3001'));
}
module.exports = app; 