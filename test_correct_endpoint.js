const axios = require('axios');

async function testCompaniesEndpoint() {
  try {
    // Primeiro, fazer login para obter token
    console.log('🔐 Fazendo login...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'joao_motorista',
      password: 'password'
    });

    const token = loginResponse.data.data.token;
    console.log('✅ Login realizado com sucesso');
    console.log('Token:', token.substring(0, 50) + '...');

    // Testar endpoint de companies na porta 3000 (auth-service)
    console.log('\n🏢 Testando endpoint /api/auth/companies na porta 3000...');
    const companiesResponse = await axios.get('http://localhost:3000/api/auth/companies', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('✅ Companies endpoint funcionando na porta 3000');
    console.log('Resposta:', JSON.stringify(companiesResponse.data, null, 2));

    // Testar endpoint de companies na porta 3001 (auth-users-service) - deve falhar
    console.log('\n❌ Testando endpoint /api/auth/companies na porta 3001...');
    try {
      const companiesResponse3001 = await axios.get('http://localhost:3001/api/auth/companies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log('❌ Inesperado: endpoint funcionou na porta 3001');
    } catch (error) {
      console.log('✅ Esperado: endpoint não existe na porta 3001');
      console.log('Erro:', error.response?.status, error.response?.statusText);
    }

  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
  }
}

testCompaniesEndpoint(); 