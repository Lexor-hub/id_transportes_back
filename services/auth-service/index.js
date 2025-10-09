require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const express = require('express');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(express.json());

const jwtSecret = process.env.JWT_SECRET || "fda76ff877a92f9a86e7831fad372e2d9e777419e155aab4f5b18b37d280d05a";

// CORREÇÃO: Adiciona a porta 5173 (do Vite) à lista de origens permitidas
// Lista de origens permitidas locais e configuráveis via ambiente
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

const vercelOriginPattern = /^https:\/\/idtransportes-.*\.vercel\.app$/;
const allowedOriginSet = new Set([...defaultOrigins, ...envOrigins]);

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (allowedOriginSet.has(origin)) return true;
  return vercelOriginPattern.test(origin);
}

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const allowed = isOriginAllowed(origin);

  res.header('Access-Control-Allow-Credentials', 'true');
  res.header('Access-Control-Allow-Headers', 'Authorization, Content-Type, X-Requested-With');
  res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');

  if (allowed && origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  } else if (origin && !allowed) {
    console.error(`CORS Error: Origin '${origin}' not allowed.`);
  }

  if (req.method === 'OPTIONS') {
    return allowed ? res.sendStatus(204) : res.status(403).send('CORS origin denied');
  }

  if (!allowed) {
    return res.status(403).json({ success: false, error: 'CORS origin denied' });
  }

  next();
});

app.post('/api/auth/login', async (req, res) => {
    const { username, password } = req.body;

    if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Usuário e senha são obrigatórios.' });
    }

    try {
        const [users] = await pool.query(
            `SELECT u.*, c.name as company_name, c.domain as company_domain 
             FROM users u 
             LEFT JOIN companies c ON u.company_id = c.id 
             WHERE u.username = ? OR u.cpf = ?`,
            [username, username]
        );

        if (users.length === 0) {
            return res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
        }

        const user = users[0];

        let driverId = null;
        if (user.user_type === 'DRIVER') {
            const [driverRows] = await pool.query(
                'SELECT id, company_id FROM drivers WHERE user_id = ? ORDER BY updated_at DESC LIMIT 1',
                [user.id]
            );

            if (driverRows.length > 0) {
                driverId = driverRows[0].id;
                if (!user.company_id && driverRows[0].company_id) {
                    user.company_id = driverRows[0].company_id;
                }
            }
        }

        const isPasswordValid = await bcrypt.compare(password, user.password_hash);

        if (!isPasswordValid) {
            return res.status(401).json({ success: false, error: 'Credenciais inválidas.' });
        }

        // Payload do token
        const tokenPayload = {
            id: user.id,
            user_id: user.id, // Mantendo user_id para compatibilidade
            username: user.username,
            user_type: user.user_type,
            company_id: user.company_id,
        };

        const token = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '24h' });

        // Prepara os dados do usuário para a resposta
        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            user_type: user.user_type,
            company_id: user.company_id,
            company_name: user.company_name,
            company_domain: user.company_domain,
            driver_id: driverId
        };

        res.json({
            success: true,
            data: {
                token,
                user: userResponse
            }
        });

    } catch (error) {
        console.error('Erro no login:', error);
        res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
    }
});


app.get('/api/auth/companies', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Token não fornecido.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: 'Token inválido.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, jwtSecret);
    } catch (error) {
        console.error('Erro ao validar token:', error);
        return res.status(401).json({ success: false, error: 'Token inválido.' });
    }

    try {
        const userId = decoded.id || decoded.user_id;
        const userType = decoded.user_type;
        let companies = [];

        if (userType === 'MASTER') {
            const [rows] = await pool.query(
                `SELECT id, name, domain, email, subscription_plan
                 FROM companies
                 WHERE is_active = 1
                 ORDER BY name ASC`
            );
            companies = rows;
        } else {
            let companyId = decoded.company_id;

            if (!companyId && userId) {
                const [userRows] = await pool.query(
                    'SELECT company_id FROM users WHERE id = ? LIMIT 1',
                    [userId]
                );

                if (userRows.length > 0) {
                    companyId = userRows[0].company_id;
                }
            }

            if (!companyId) {
                return res.json({ success: true, data: [] });
            }

            const [rows] = await pool.query(
                `SELECT id, name, domain, email, subscription_plan
                 FROM companies
                 WHERE id = ? AND is_active = 1
                 LIMIT 1`,
                [companyId]
            );
            companies = rows;
        }

        const data = companies.map((company) => ({
            id: String(company.id),
            name: company.name,
            domain: company.domain,
            email: company.email || null,
            subscription_plan: company.subscription_plan || null,
        }));

        return res.json({ success: true, data });
    } catch (error) {
        console.error('Erro ao buscar empresas:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
    }
});

app.post('/api/auth/select-company', async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return res.status(401).json({ success: false, error: 'Token não fornecido.' });
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
        return res.status(401).json({ success: false, error: 'Token inválido.' });
    }

    let decoded;
    try {
        decoded = jwt.verify(token, jwtSecret);
    } catch (error) {
        console.error('Erro ao validar token:', error);
        return res.status(401).json({ success: false, error: 'Token inválido.' });
    }

    const { company_id: companyId } = req.body || {};
    if (!companyId) {
        return res.status(400).json({ success: false, error: 'company_id é obrigatório.' });
    }

    try {
        const [companyRows] = await pool.query(
            `SELECT id, name, domain, email, subscription_plan
             FROM companies
             WHERE id = ? AND is_active = 1
             LIMIT 1`,
            [companyId]
        );

        if (companyRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Empresa não encontrada.' });
        }

        const company = companyRows[0];
        const userId = decoded.id || decoded.user_id;
        const userType = decoded.user_type;

        const [userRows] = await pool.query(
            `SELECT u.id, u.username, u.email, u.full_name, u.user_type, u.company_id, u.cpf,
                    c.name AS company_name, c.domain AS company_domain
             FROM users u
             LEFT JOIN companies c ON u.company_id = c.id
             WHERE u.id = ?
             LIMIT 1`,
            [userId]
        );

        if (userRows.length === 0) {
            return res.status(404).json({ success: false, error: 'Usuário não encontrado.' });
        }

        const user = userRows[0];

        let driverId = null;
        if (user.user_type === 'DRIVER') {
            const [driverRows] = await pool.query(
                'SELECT id, company_id FROM drivers WHERE user_id = ? AND company_id = ? LIMIT 1',
                [user.id, company.id]
            );

            if (driverRows.length > 0) {
                driverId = driverRows[0].id;
            } else {
                const [fallbackDriverRows] = await pool.query(
                    'SELECT id, company_id FROM drivers WHERE user_id = ? LIMIT 1',
                    [user.id]
                );

                if (fallbackDriverRows.length > 0) {
                    driverId = fallbackDriverRows[0].id;
                    if (fallbackDriverRows[0].company_id !== company.id) {
                        await pool.query('UPDATE drivers SET company_id = ? WHERE id = ?', [company.id, driverId]);
                    }
                } else {
                    const generatedCpf = user.cpf || `tmp${user.id}${Date.now().toString().slice(-6)}`;
                    const [insertResult] = await pool.query(
                        'INSERT INTO drivers (user_id, company_id, cpf, phone_number, tech_knowledge, is_outsourced, status, created_at, updated_at) VALUES (?, ?, ?, NULL, NULL, 1, ?, NOW(), NOW())',
                        [user.id, company.id, generatedCpf, 'active']
                    );
                    driverId = insertResult.insertId;
                }
            }
        }

        if (userType !== 'MASTER' && user.company_id && String(user.company_id) !== String(company.id)) {
            return res.status(403).json({ success: false, error: 'Usuário não tem acesso à empresa selecionada.' });
        }

        const tokenPayload = {
            id: user.id,
            user_id: user.id,
            username: user.username,
            user_type: user.user_type,
            company_id: company.id,
        };

        const newToken = jwt.sign(tokenPayload, jwtSecret, { expiresIn: '24h' });

        const userResponse = {
            id: user.id,
            username: user.username,
            email: user.email,
            full_name: user.full_name,
            user_type: user.user_type,
            company_id: company.id,
            company_name: company.name,
            company_domain: company.domain,
            driver_id: driverId
        };

        return res.json({
            success: true,
            data: {
                token: newToken,
                user: userResponse,
            },
        });
    } catch (error) {
        console.error('Erro ao selecionar empresa:', error);
        return res.status(500).json({ success: false, error: 'Erro interno do servidor.' });
    }
});


// Adicione outras rotas de autenticação aqui se necessário...


// CORREÇÃO: Usa a porta do .env ou a porta padrão 3000.
// Prioriza a variável correta do .env do backend.
const PORT = process.env.AUTH_SERVICE_PORT || 3000;
app.listen(PORT, () => {
  const summaryOrigins = [...allowedOriginSet, vercelOriginPattern.toString()];
  console.log(`?? CORS configurado para as origens: [
  ${summaryOrigins.map((origin) => `'${origin}'`).join(',\n  ')}
]`);
  console.log(`Auth Service rodando na porta ${PORT}`);
});

module.exports = app;

