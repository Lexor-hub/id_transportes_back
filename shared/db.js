require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mysql = require('mysql2/promise');

// Configuração do Pool de Conexões
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT || 3306,
  
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
