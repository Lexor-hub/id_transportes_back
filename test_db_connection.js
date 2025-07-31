const pool = require('./shared/db');

async function testDatabase() {
  try {
    console.log('🔍 Testando conexão com o banco...');
    
    // Testar conexão
    const [rows] = await pool.query('SELECT 1 as test');
    console.log('✅ Conexão com banco OK:', rows);
    
    // Verificar se a tabela companies existe
    const [companies] = await pool.query('SHOW TABLES LIKE "companies"');
    console.log('📋 Tabela companies existe:', companies.length > 0);
    
    if (companies.length > 0) {
      // Verificar dados da tabela companies
      const [companyData] = await pool.query('SELECT * FROM companies');
      console.log('📊 Dados da tabela companies:', companyData);
    }
    
    // Verificar se a tabela users existe e tem dados
    const [users] = await pool.query('SELECT id, username, user_type, company_id FROM users');
    console.log('👥 Usuários:', users);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

testDatabase(); 