const pool = require('./shared/db');

async function debugCompanySearch() {
  try {
    console.log('🔍 Debugando busca de empresa...');
    
    // Testar busca exata
    console.log('\n1. Buscando empresa com domain "idtransportes"...');
    const [exactMatch] = await pool.execute('SELECT * FROM companies WHERE domain = ?', ['idtransportes']);
    console.log('Resultado:', exactMatch);
    
    // Testar busca com filtro ativo
    console.log('\n2. Buscando empresa ativa com domain "idtransportes"...');
    const [activeMatch] = await pool.execute('SELECT * FROM companies WHERE domain = ? AND is_active = 1', ['idtransportes']);
    console.log('Resultado:', activeMatch);
    
    // Listar todas as empresas
    console.log('\n3. Listando todas as empresas...');
    const [allCompanies] = await pool.execute('SELECT id, name, domain, is_active FROM companies');
    console.log('Todas as empresas:');
    allCompanies.forEach(company => {
      console.log(`- ID: ${company.id}, Nome: ${company.name}, Domain: ${company.domain}, Ativo: ${company.is_active}`);
    });
    
    // Testar query exata do código
    console.log('\n4. Testando query exata do código de login...');
    const [codeMatch] = await pool.query('SELECT id FROM companies WHERE domain = ? AND is_active = 1', ['idtransportes']);
    console.log('Query do código:', codeMatch);
    
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await pool.end();
  }
}

debugCompanySearch();