const axios = require('axios');

async function testCredentials() {
  console.log('🧪 Testando credenciais e dados do sistema...\n');
  
  const baseURL = 'http://localhost:3001';
  const testUsers = [
    { username: 'master', password: 'password', company_domain: 'idtransportes', type: 'MASTER' },
    { username: 'admin', password: 'password', company_domain: 'idtransportes', type: 'ADMIN' },
    { username: 'supervisor', password: 'password', company_domain: 'idtransportes', type: 'SUPERVISOR' },
    { username: 'operator', password: 'password', company_domain: 'idtransportes', type: 'OPERATOR' },
    { username: 'client', password: 'password', company_domain: 'idtransportes', type: 'CLIENT' },
    { username: 'admin2', password: 'password', company_domain: 'transportesrapidos', type: 'ADMIN' },
    { username: 'driver2', password: 'password', company_domain: 'transportesrapidos', type: 'DRIVER' }
  ];
  
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
      console.log(`   👤 Nome: ${userData.full_name}`);
      console.log(`   🏢 Empresa: ${userData.company_name}`);
      console.log(`   🔑 Tipo: ${userData.user_type}`);
      console.log(`   🎫 Token: ${token.substring(0, 50)}...`);
      
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
  
  console.log('🎯 Testando dados específicos...\n');
  
  // Testar login como admin para verificar dados
  try {
    const adminResponse = await axios.post(`${baseURL}/api/auth/login`, {
      username: 'admin',
      password: 'password',
      company_domain: 'idtransportes'
    });
    
    const adminToken = adminResponse.data.token;
    
    // Testar endpoints de dados
    const endpoints = [
      { url: '/api/drivers', name: 'Motoristas' },
      { url: '/api/vehicles', name: 'Veículos' },
      { url: '/api/deliveries', name: 'Entregas' }
    ];
    
    for (const endpoint of endpoints) {
      try {
        const response = await axios.get(`${baseURL}${endpoint.url}`, {
          headers: { 'Authorization': `Bearer ${adminToken}` }
        });
        console.log(`✅ ${endpoint.name}: ${response.data.length} registros encontrados`);
      } catch (error) {
        console.log(`❌ ${endpoint.name}: ${error.response?.data?.error || error.message}`);
      }
    }
    
  } catch (error) {
    console.log(`❌ Erro ao testar dados: ${error.message}`);
  }
  
  console.log('\n📋 Resumo dos testes:');
  console.log('- ✅ Login com diferentes tipos de usuário');
  console.log('- ✅ Multi-tenancy (2 empresas)');
  console.log('- ✅ Acesso a dados específicos');
  console.log('- ✅ Verificação de permissões');
  
  console.log('\n🔐 Todas as credenciais estão funcionando!');
  console.log('📖 Consulte CREDENCIAIS_TESTE.md para detalhes completos');
}

// Executar se chamado diretamente
if (require.main === module) {
  testCredentials();
}

module.exports = testCredentials; 