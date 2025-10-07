const pool = require('./shared/db');

async function checkTableStructure() {
  try {
    console.log('🔍 Verificando estrutura da tabela users...');
    
    const [rows] = await pool.execute('DESCRIBE users');
    console.log('\n📋 Estrutura da tabela users:');
    rows.forEach(row => {
      console.log(`- ${row.Field}: ${row.Type} ${row.Null === 'NO' ? '(NOT NULL)' : '(NULL)'} ${row.Key ? `(${row.Key})` : ''}`);
    });
    
    console.log('\n🔍 Verificando dados de exemplo...');
    const [userData] = await pool.execute('SELECT id, username, password, company_id FROM users LIMIT 3');
    console.log('\n👥 Primeiros usuários:');
    userData.forEach(user => {
      console.log(`- ID: ${user.id}, Username: ${user.username}, Password: ${user.password ? user.password.substring(0, 20) + '...' : 'NULL'}, Company: ${user.company_id}`);
    });
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

checkTableStructure();