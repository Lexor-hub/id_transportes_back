const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host: process.env.DB_HOST || '207.180.252.4',
  user: process.env.DB_USER || 'glaubermag',
  password: process.env.DB_PASSWORD || 'C@C3te12',
  database: process.env.DB_NAME || 'id_transportes',
  port: parseInt(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 15, // 🔧 Aumentado para suportar múltiplos serviços
  queueLimit: 0,
  acquireTimeout: 60000, // 🔧 60 segundos - mais tempo para conexões lentas
  idleTimeout: 600000, // 🔧 10 minutos - conexões ficam ativas por mais tempo
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // 🔧 Configurações válidas para mysql2
  multipleStatements: false,
  dateStrings: false
});

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

console.log('🗄️ Pool de conexões MySQL configurado com:');
console.log('   - Limite de conexões: 15');
console.log('   - Timeout de aquisição: 60000ms');
console.log('   - Idle timeout: 600000ms');
console.log('   - Keep alive habilitado');

module.exports = pool;