const mysql = require('mysql2/promise');
require('dotenv').config();

const poolConfig = {
  waitForConnections: true,
  connectionLimit: 15,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // 🔧 Opções adicionais para estabilidade
  multipleStatements: false,
  dateStrings: true, // Garante que datas sejam retornadas como strings
};

// 🔧 Lógica aprimorada para suportar Railway (DATABASE_URL) e desenvolvimento local
if (process.env.DATABASE_URL) {
  console.log('✅ Detectado ambiente de produção (Railway). Usando DATABASE_URL.');
  poolConfig.uri = process.env.DATABASE_URL;
} else {
  console.log('✅ Detectado ambiente de desenvolvimento. Usando variáveis do .env.');
  const requiredEnv = ['DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_PORT'];
  const missingEnv = requiredEnv.filter((key) => !process.env[key]);

  if (missingEnv.length) {
    console.error('❌ Erro: Variáveis de ambiente locais ausentes:', missingEnv.join(', '));
    throw new Error(`Variáveis de ambiente locais ausentes: ${missingEnv.join(', ')}`);
  }

  poolConfig.host = process.env.DB_HOST;
  poolConfig.user = process.env.DB_USER;
  poolConfig.password = process.env.DB_PASSWORD;
  poolConfig.database = process.env.DB_NAME;
  poolConfig.port = Number(process.env.DB_PORT);
}

console.log('🗄️  Configurando pool de conexões MySQL...');

const pool = mysql.createPool(poolConfig);

// 🔧 TRATAMENTO DE ERROS E RECONEXÃO AUTOMÁTICA
// Adicionar listeners para eventos do pool
pool.on('connection', function (connection) {
  console.log('📡 Nova conexão estabelecida como id ' + connection.threadId);
});

pool.on('error', function(err) {
  console.error('❌ Erro no pool de conexões MySQL:', err);
  if(err.code === 'PROTOCOL_CONNECTION_LOST' || err.code === 'ECONNRESET') {
    console.log('🔄 Tentando reconectar ao banco de dados...');
    // O pool automaticamente tentará reconectar
  } else {
    throw err;
  }
});

// 🔧 FUNÇÃO HELPER PARA EXECUTAR QUERIES COM RETRY
pool.executeWithRetry = async function(query, params, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const [rows] = await this.query(query, params);
      return [rows];
    } catch (error) {
      console.warn(`⚠️ Tentativa ${attempt}/${maxRetries} falhou:`, error.message);
      
      if (attempt === maxRetries) {
        console.error('❌ Todas as tentativas falharam. Erro final:', error);
        throw error;
      }
      
      if (error.code === 'ECONNRESET' || error.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('🔄 Aguardando antes de tentar novamente...');
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // Backoff exponencial
      } else {
        throw error; // Se não for erro de conexão, não tenta novamente
      }
    }
  }
};

module.exports = pool;