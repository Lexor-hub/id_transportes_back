const mysql = require('mysql2/promise');
require('dotenv').config();

async function checkDatabase() {
  let connection;
  
  try {
    console.log('🔧 Conectando ao banco de dados...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    console.log('✅ Conectado ao banco de dados');
    
    // Verificar tabelas existentes
    const [tables] = await connection.execute('SHOW TABLES');
    console.log('\n📋 Tabelas existentes:');
    tables.forEach(table => {
      console.log(`- ${Object.values(table)[0]}`);
    });
    
    // Verificar estrutura das tabelas principais
    const mainTables = ['companies', 'users', 'vehicles', 'drivers', 'deliveries'];
    
    for (const tableName of mainTables) {
      try {
        const [columns] = await connection.execute(`DESCRIBE ${tableName}`);
        console.log(`\n🏗️ Estrutura da tabela ${tableName}:`);
        columns.forEach(col => {
          console.log(`  - ${col.Field}: ${col.Type} ${col.Null === 'NO' ? 'NOT NULL' : ''} ${col.Key ? `(${col.Key})` : ''}`);
        });
      } catch (error) {
        console.log(`❌ Tabela ${tableName} não existe: ${error.message}`);
      }
    }
    
    // Verificar dados existentes
    console.log('\n📊 Dados existentes:');
    
    try {
      const [companies] = await connection.execute('SELECT COUNT(*) as count FROM companies');
      console.log(`- Companies: ${companies[0].count} registros`);
    } catch (error) {
      console.log('- Companies: Tabela não existe');
    }
    
    try {
      const [users] = await connection.execute('SELECT COUNT(*) as count FROM users');
      console.log(`- Users: ${users[0].count} registros`);
    } catch (error) {
      console.log('- Users: Tabela não existe');
    }
    
    try {
      const [vehicles] = await connection.execute('SELECT COUNT(*) as count FROM vehicles');
      console.log(`- Vehicles: ${vehicles[0].count} registros`);
    } catch (error) {
      console.log('- Vehicles: Tabela não existe');
    }
    
    try {
      const [drivers] = await connection.execute('SELECT COUNT(*) as count FROM drivers');
      console.log(`- Drivers: ${drivers[0].count} registros`);
    } catch (error) {
      console.log('- Drivers: Tabela não existe');
    }
    
    try {
      const [deliveries] = await connection.execute('SELECT COUNT(*) as count FROM deliveries');
      console.log(`- Deliveries: ${deliveries[0].count} registros`);
    } catch (error) {
      console.log('- Deliveries: Tabela não existe');
    }
    
  } catch (error) {
    console.error('❌ Erro ao verificar banco:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Conexão com banco fechada');
    }
  }
}

if (require.main === module) {
  checkDatabase();
}

module.exports = checkDatabase; 