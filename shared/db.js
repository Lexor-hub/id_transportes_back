const path = require('path');
const { URL } = require('url');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

function buildConnectionConfig() {
  if (process.env.DATABASE_URL) {
    try {
      const dbUrl = new URL(process.env.DATABASE_URL);

      return {
        host: dbUrl.hostname,
        user: decodeURIComponent(dbUrl.username),
        password: decodeURIComponent(dbUrl.password),
        database: dbUrl.pathname ? dbUrl.pathname.replace(/^\//, '') : undefined,
        port: dbUrl.port ? Number(dbUrl.port) : 3306
      };
    } catch (error) {
      console.error('❌ DATABASE_URL inválida. Verifique o formato da variável.', error.message);
    }
  }

  return {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 3306
  };
}

const baseConfig = buildConnectionConfig();

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
