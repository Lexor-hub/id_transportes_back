const pool = require('./shared/db');

async function activateCompany() {
  try {
    console.log('🔧 Ativando empresa ID Transportes...');
    
    const [result] = await pool.execute('UPDATE companies SET is_active = 1 WHERE domain = ?', ['idtransportes']);
    console.log('✅ Empresa ativada! Linhas afetadas:', result.affectedRows);
    
    // Verificar se foi ativada
    const [company] = await pool.execute('SELECT id, name, domain, is_active FROM companies WHERE domain = ?', ['idtransportes']);
    console.log('📊 Status da empresa:', company[0]);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

activateCompany();