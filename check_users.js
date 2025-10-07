const pool = require('./shared/db');
const bcrypt = require('bcrypt');

async function checkAndCreateTestData() {
  console.log('🔍 Verificando dados de teste no banco...');
  
  try {
    // Verificar se há empresas
    const [companies] = await pool.execute('SELECT * FROM companies');
    console.log(`📊 Empresas encontradas: ${companies.length}`);
    
    // Verificar se há usuários
    const [users] = await pool.execute('SELECT * FROM users');
    console.log(`👥 Usuários encontrados: ${users.length}`);
    
    if (companies.length === 0) {
      console.log('🏢 Criando empresa de teste...');
      await pool.execute(`
        INSERT INTO companies (name, domain, email, subscription_plan, is_active) 
        VALUES ('ID Transportes', 'idtransportes', 'contato@idtransportes.com', 'premium', 1)
      `);
      console.log('✅ Empresa criada!');
    }
    
    // Buscar ID da empresa
    const [companyResult] = await pool.execute('SELECT id FROM companies WHERE domain = ?', ['idtransportes']);
    const companyId = companyResult[0]?.id;
    
    if (!companyId) {
      throw new Error('Empresa não encontrada!');
    }
    
    if (users.length === 0) {
      console.log('👤 Criando usuário master...');
      const hashedPassword = await bcrypt.hash('password', 10);
      
      await pool.execute(`
        INSERT INTO users (username, password_hash, email, full_name, user_type, company_id, is_active) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, ['master', hashedPassword, 'master@idtransportes.com', 'Administrador Master', 'MASTER', companyId, 1]);
      
      console.log('✅ Usuário master criado!');
    }
    
    // Verificar dados finais
    const [finalCompanies] = await pool.execute('SELECT * FROM companies');
    const [finalUsers] = await pool.execute('SELECT username, email, user_type, company_id FROM users');
    
    console.log('\n📋 Dados finais:');
    console.log('🏢 Empresas:', finalCompanies.map(c => ({ name: c.name, domain: c.domain })));
    console.log('👥 Usuários:', finalUsers.map(u => ({ username: u.username, type: u.user_type })));
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

checkAndCreateTestData();