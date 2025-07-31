const axios = require('axios');

async function testCorrectedCredentials() {
  console.log('🧪 Testando credenciais corrigidas...\n');
  
  const baseURL = 'http://localhost:3001';
  const testUsers = [
    { username: 'master', password: 'password', company_domain: 'idtransportes', type: 'MASTER' },
    { username: 'admin', password: 'password', company_domain: 'idtransportes', type: 'ADMIN' },
    { username: 'supervisor', password: 'password', company_domain: 'idtransportes', type: 'SUPERVISOR' },
    { username: 'operator', password: 'password', company_domain: 'idtransportes', type: 'OPERATOR' },
    { username: 'client', password: 'password', company_domain: 'idtransportes', type: 'CLIENT' },
    { username: 'joao_motorista', password: 'password', company_domain: 'idtransportes', type: 'DRIVER' },
    { username: 'maria_motorista', password: 'password', company_domain: 'idtransportes', type: 'DRIVER' },
    { username: 'pedro_motorista', password: 'password', company_domain: 'idtransportes', type: 'DRIVER' },
    { username: 'admin2', password: 'password', company_domain: 'transportesrapidos', type: 'ADMIN' },
    { username: 'driver2', password: 'password', company_domain: 'transportesrapidos', type: 'DRIVER' }
  ];
  
  let successCount = 0;
  let totalCount = testUsers.length;
  
  for (const user of testUsers) {
    try {
      console.log(`🔐 Testando login: ${user.username} (${user.type})`);
      
      const response = await axios.post(`${baseURL}/api/auth/login`, {
        username: user.username,
        password: user.password,
        company_domain: user.company_domain
      });
      
      const { token, user: userData } = response.data;
      
      console.log(`✅ Login bem-sucedido!`);
      console.log(`   👤 Nome: ${userData.full_name || 'N/A'}`);
      console.log(`   🏢 Empresa: ${userData.company_name || 'N/A'}`);
      console.log(`   🔑 Tipo: ${userData.user_type || 'N/A'}`);
      console.log(`   🎫 Token: ${token.substring(0, 50)}...`);
      
      successCount++;
      
      // Testar acesso a endpoints protegidos
      try {
        const usersResponse = await axios.get(`${baseURL}/api/users`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        console.log(`   📊 Usuários encontrados: ${usersResponse.data.length}`);
      } catch (error) {
        console.log(`   ⚠️ Acesso a /api/users: ${error.response?.status === 403 ? 'Negado (esperado)' : 'Erro'}`);
      }
      
      console.log('');
      
    } catch (error) {
      console.log(`❌ Falha no login: ${error.response?.data?.error || error.message}`);
      console.log('');
    }
  }
  
  console.log('🎯 Resumo dos testes:');
  console.log(`✅ Logins bem-sucedidos: ${successCount}/${totalCount}`);
  console.log(`📊 Taxa de sucesso: ${((successCount/totalCount)*100).toFixed(1)}%`);
  
  if (successCount === totalCount) {
    console.log('\n🎉 TODAS as credenciais estão funcionando!');
  } else {
    console.log('\n⚠️ Algumas credenciais falharam. Verifique os logs acima.');
  }
  
  console.log('\n📖 Consulte o arquivo CREDENCIAIS_TESTE.md para detalhes completos');
}

if (require.main === module) {
  testCorrectedCredentials();
}

module.exports = testCorrectedCredentials; 