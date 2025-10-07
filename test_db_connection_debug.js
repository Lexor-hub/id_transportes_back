const mysql = require('mysql2/promise');
require('dotenv').config();

async function testConnection() {
  console.log('🔍 Testando conexão com o banco de dados...');
  console.log('📋 Configurações:');
  console.log(`   Host: ${process.env.DB_HOST}`);
  console.log(`   User: ${process.env.DB_USER}`);
  console.log(`   Database: ${process.env.DB_NAME}`);
  console.log(`   Port: ${process.env.DB_PORT}`);
  
  try {
    // Teste de conexão simples
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: parseInt(process.env.DB_PORT) || 3306,
      connectTimeout: 10000,
      acquireTimeout: 10000,
      timeout: 10000
    });
    
    console.log('✅ Conexão estabelecida com sucesso!');
    
    // Teste de query simples
    const [rows] = await connection.execute('SELECT 1 as test');
    console.log('✅ Query de teste executada:', rows);
    
    // Teste de listagem de tabelas
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('📊 Tabelas encontradas:', tables.length);
    
    await connection.end();
    console.log('✅ Conexão fechada corretamente');
    
  } catch (error) {
    console.error('❌ Erro na conexão:', error.message);
    console.error('📋 Detalhes do erro:', {
      code: error.code,
      errno: error.errno,
      sqlState: error.sqlState,
      sqlMessage: error.sqlMessage
    });
    
    if (error.code === 'ECONNRESET') {
      console.log('\n🔧 Possíveis soluções para ECONNRESET:');
      console.log('   1. Verificar se o servidor MySQL está rodando');
      console.log('   2. Verificar firewall/rede');
      console.log('   3. Verificar timeout de conexão');
      console.log('   4. Verificar se há muitas conexões simultâneas');
    }
  }
}

testConnection();