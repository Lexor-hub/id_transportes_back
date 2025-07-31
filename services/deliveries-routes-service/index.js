const express = require('express');
const pool = require('../../shared/db');
const jwt = require('jsonwebtoken');
const app = express();
app.use(express.json());

const cors = require('cors');
const multer = require('multer');
const xml2js = require('xml2js');
const fs = require('fs');
const swaggerUi = require('swagger-ui-express');
const swaggerJsdoc = require('swagger-jsdoc');

// Swagger setup
const swaggerDefinition = {
  openapi: '3.0.0',
  info: {
    title: 'API Deliveries/Routes',
    version: '1.0.0',
    description: 'Documentação da API de entregas e rotas'
  }
};
const options = {
  swaggerDefinition,
  apis: ['./index.js'],
};
const swaggerSpec = swaggerJsdoc(options);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(cors({ origin: '*', credentials: true }));

const upload = multer({ dest: 'uploads/xmls/' });

/**
 * @swagger
 * /api/sefaz/import-xml:
 *   post:
 *     summary: Importa XML de nota fiscal do SEFAZ
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               xml:
 *                 type: string
 *                 format: binary
 *     responses:
 *       200:
 *         description: XML importado com sucesso
 */
app.post('/api/sefaz/import-xml', upload.single('xml'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Arquivo não enviado' });
  const xml = fs.readFileSync(req.file.path, 'utf8');
  xml2js.parseString(xml, async (err, result) => {
    if (err) return res.status(400).json({ error: 'XML inválido' });
    try {
      const nfe = result.nfeProc.NFe[0].infNFe[0];
      const nf_number = nfe.ide[0].nNF[0];
      const client_name = nfe.dest[0].xNome[0];
      const delivery_address = nfe.dest[0].enderDest[0].xLgr[0] + ', ' + nfe.dest[0].enderDest[0].nro[0];
      const merchandise_value = nfe.total[0].ICMSTot[0].vNF[0];
      await pool.query(
        'INSERT INTO delivery_notes (nf_number, client_name_extracted, delivery_address, merchandise_value, xml_data, status) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE client_name_extracted=?, delivery_address=?, merchandise_value=?, xml_data=?, status=?',
        [nf_number, client_name, delivery_address, merchandise_value, xml, 'PENDING', client_name, delivery_address, merchandise_value, xml, 'PENDING']
      );
      res.json({ message: 'XML importado com sucesso', nf_number, client_name, delivery_address, merchandise_value });
    } catch (e) {
      res.status(400).json({ error: 'Estrutura de XML não reconhecida', details: e.message });
    }
  });
});

/**
 * @swagger
 * /api/deliveries:
 *   get:
 *     summary: Lista todas as entregas
 *     parameters:
 *       - in: query
 *         name: data
 *         schema:
 *           type: string
 *         description: Data da entrega
 *       - in: query
 *         name: cliente
 *         schema:
 *           type: string
 *         description: ID do cliente
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Status da entrega
 *     responses:
 *       200:
 *         description: Lista de entregas
 */
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

// Cadastro de entrega (ADMIN)
app.post('/api/deliveries', authorize(['ADMIN']), async (req, res) => {
  const { nf_number, client_id, delivery_address, delivery_volume, merchandise_value, products_description, status, delivery_date_expected } = req.body;
  try {
    // Validação de NF única
    const [exists] = await pool.query('SELECT id FROM delivery_notes WHERE nf_number = ?', [nf_number]);
    if (exists.length > 0) return res.status(400).json({ error: 'NF já cadastrada' });
    await pool.query(
      'INSERT INTO delivery_notes (nf_number, client_id, delivery_address, delivery_volume, merchandise_value, products_description, status, delivery_date_expected) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [nf_number, client_id, delivery_address, delivery_volume, merchandise_value, products_description, status, delivery_date_expected]
    );
    res.status(201).json({ message: 'Entrega cadastrada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listar entregas com filtros
app.get('/api/deliveries', async (req, res) => {
  const { data, cliente, status } = req.query;
  let sql = 'SELECT * FROM delivery_notes WHERE 1=1';
  const params = [];
  if (data) {
    sql += ' AND delivery_date_expected = ?';
    params.push(data);
  }
  if (cliente) {
    sql += ' AND client_id = ?';
    params.push(cliente);
  }
  if (status) {
    sql += ' AND status = ?';
    params.push(status);
  }
  try {
    const [rows] = await pool.query(sql, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cadastro de rota (ADMIN)
app.post('/api/routes', authorize(['ADMIN']), async (req, res) => {
  const { driver_id, vehicle_id, status } = req.body;
  try {
    await pool.query(
      'INSERT INTO routes (driver_id, vehicle_id, status) VALUES (?, ?, ?)',
      [driver_id, vehicle_id, status]
    );
    res.status(201).json({ message: 'Rota criada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Listar rotas
app.get('/api/routes', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM routes');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Detalhes de entrega
app.get('/api/deliveries/:id', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM delivery_notes WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Entrega não encontrada' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Atualizar status da entrega
app.put('/api/deliveries/:id/status', async (req, res) => {
  const { status } = req.body;
  try {
    await pool.query('UPDATE delivery_notes SET status=? WHERE id=?', [status, req.params.id]);
    res.json({ message: 'Status atualizado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Registrar ocorrência
app.put('/api/deliveries/:id/occurrence', async (req, res) => {
  const { is_reattempt, refusal_reason, observations } = req.body;
  try {
    await pool.query(
      'UPDATE delivery_notes SET is_reattempt=?, refusal_reason=?, observations=? WHERE id=?',
      [is_reattempt, refusal_reason, observations, req.params.id]
    );
    res.json({ message: 'Ocorrência registrada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Iniciar dia
app.post('/api/routes/:id/start-day', async (req, res) => {
  try {
    await pool.query('UPDATE routes SET start_datetime=NOW(), status="IN_PROGRESS" WHERE id=?', [req.params.id]);
    res.json({ message: 'Dia iniciado' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Iniciar rota
app.post('/api/routes/:id/start-route', async (req, res) => {
  try {
    await pool.query('UPDATE routes SET status="IN_PROGRESS" WHERE id=?', [req.params.id]);
    res.json({ message: 'Rota iniciada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Finalizar rota
app.post('/api/routes/:id/finish-route', async (req, res) => {
  try {
    await pool.query('UPDATE routes SET end_datetime=NOW(), status="COMPLETED" WHERE id=?', [req.params.id]);
    res.json({ message: 'Rota finalizada' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Entregas do motorista no dia
app.get('/api/drivers/:driverId/today-deliveries', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT dn.* FROM delivery_notes dn
       JOIN route_deliveries rd ON dn.id = rd.delivery_note_id
       JOIN routes r ON rd.route_id = r.id
       WHERE r.driver_id = ? AND DATE(r.start_datetime) = CURDATE()`,
      [req.params.driverId]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Integração SEFAZ (importação de XML) pode ser implementada aqui futuramente.
if (require.main === module) {
  app.listen(3003, () => console.log('Deliveries/Routes Service rodando na porta 3003'));
}
module.exports = app; 