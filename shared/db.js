const path = require('path');
const { URL } = require('url');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

const FALSE_LIKE = new Set(['0', 'false', 'disable', 'disabled', 'off', 'no']);

function inferSslFromEnv() {
  const rawFlag = process.env.DB_SSL || process.env.MYSQL_SSL || process.env.DATABASE_SSL;
  if (!rawFlag || FALSE_LIKE.has(rawFlag.toLowerCase())) {
    return null;
  }

  const base = {
    rejectUnauthorized: true
  };

  const rejectFlag = process.env.DB_SSL_REJECT_UNAUTHORIZED || process.env.MYSQL_SSL_REJECT_UNAUTHORIZED;
  if (rejectFlag) {
    base.rejectUnauthorized = !FALSE_LIKE.has(rejectFlag.toLowerCase());
  }

  const caPath = process.env.DB_SSL_CA_PATH || process.env.MYSQL_SSL_CA_PATH;
  const caInline = process.env.DB_SSL_CA || process.env.MYSQL_SSL_CA;
  if (caPath) {
    try {
      base.ca = fs.readFileSync(path.resolve(__dirname, '..', caPath), 'utf8');
    } catch (error) {
      console.error('❌ Não foi possível ler o certificado CA informado em DB_SSL_CA_PATH:', error.message);
    }
  } else if (caInline) {
    base.ca = caInline.replace(/\\n/g, '\n');
  }

  const certPath = process.env.DB_SSL_CERT_PATH || process.env.MYSQL_SSL_CERT_PATH;
  if (certPath) {
    try {
      base.cert = fs.readFileSync(path.resolve(__dirname, '..', certPath), 'utf8');
    } catch (error) {
      console.error('❌ Não foi possível ler o certificado informado em DB_SSL_CERT_PATH:', error.message);
    }
  }

  const keyPath = process.env.DB_SSL_KEY_PATH || process.env.MYSQL_SSL_KEY_PATH;
  if (keyPath) {
    try {
      base.key = fs.readFileSync(path.resolve(__dirname, '..', keyPath), 'utf8');
    } catch (error) {
      console.error('❌ Não foi possível ler a chave privada informada em DB_SSL_KEY_PATH:', error.message);
    }
  }

  return base;
}

function buildSslConfig(parsedUrl) {
  const explicit = inferSslFromEnv();
  if (explicit) {
    return explicit;
  }

  if (parsedUrl) {
    const sslParam = parsedUrl.searchParams.get('sslmode') || parsedUrl.searchParams.get('ssl');
    if (sslParam && !FALSE_LIKE.has(sslParam.toLowerCase())) {
      return { rejectUnauthorized: sslParam.toLowerCase() !== 'prefer' };
    }

    const sslCaParam = parsedUrl.searchParams.get('sslca');
    if (sslCaParam) {
      return { ca: sslCaParam.replace(/\\n/g, '\n'), rejectUnauthorized: true };
    }

    const sslRejectParam = parsedUrl.searchParams.get('sslreject');
    if (sslRejectParam) {
      return { rejectUnauthorized: !FALSE_LIKE.has(sslRejectParam.toLowerCase()) };
    }

    if (parsedUrl.hostname && parsedUrl.hostname.includes('railway.app')) {
      return { rejectUnauthorized: true };
    }
  }

  const host = process.env.DB_HOST;
  if (host && host.includes('railway.app')) {
    return { rejectUnauthorized: true };
  }

  return null;
}

function buildConnectionConfig() {
  if (process.env.DATABASE_URL) {
    try {
      const dbUrl = new URL(process.env.DATABASE_URL);
      const ssl = buildSslConfig(dbUrl);

      const config = {
        host: dbUrl.hostname,
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        database: dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : undefined,
        port: dbUrl.port ? Number(dbUrl.port) : 3306
      };

      if (ssl) {
        config.ssl = ssl;
        config.connectionAttributes = { program_name: 'backend-id-transportes' };
      }

      return config;
    } catch (error) {
      console.error('❌ DATABASE_URL inválida. Verifique o formato da variável.', error.message);
    }
  }

  const config = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
  };

  const ssl = buildSslConfig();
  if (ssl) {
    config.ssl = ssl;
    config.connectionAttributes = { program_name: 'backend-id-transportes' };
  }

  return config;
}

const baseConfig = buildConnectionConfig();

if (process.env.DB_DEBUG === '1') {
  const masked = {
    host: baseConfig.host,
    port: baseConfig.port,
    database: baseConfig.database,
    user: baseConfig.user ? `${baseConfig.user.slice(0, 2)}***` : undefined,
    ssl: baseConfig.ssl ? { ...baseConfig.ssl, ca: baseConfig.ssl.ca ? '[present]' : undefined } : undefined
  };
  console.log('[DB] Configuração detectada:', JSON.stringify(masked));
}

// Configuração do Pool de Conexões
const pool = mysql.createPool({
  host: baseConfig.host,
  user: baseConfig.user,
  password: baseConfig.password,
  database: baseConfig.database,
  port: baseConfig.port || 3306,
  
  // --- Configurações de Robustez ---
  waitForConnections: true, // Espera por uma conexão disponível em vez de falhar imediatamente
  connectionLimit: 10,      // Limite de conexões no pool (ajuste conforme necessário)
  queueLimit: 0,            // Sem limite de requisições na fila
  
  // --- Keep-Alive para evitar timeouts de inatividade ---
  enableKeepAlive: true,        // Ativa o envio de pacotes para manter a conexão viva
  keepAliveInitialDelay: 10000  // Envia o primeiro pacote após 10 segundos de inatividade
});

console.log('📦 Pool de conexões MySQL configurado com keep-alive.');

// Função para testar a conexão ao iniciar
async function testConnection() {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Conexão com o banco de dados MySQL estabelecida com sucesso!');
    connection.release();
  } catch (error) {
    console.error('❌ Erro ao conectar com o banco de dados MySQL:', error.message);
    // Em um ambiente de produção, você pode querer encerrar o processo se a DB for essencial
    // process.exit(1); 
  }
}

testConnection();

module.exports = pool;
