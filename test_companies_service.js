const axios = require('axios');

async function testCompaniesService() {
  try {
    console.log('🔍 Testando companies-service...');
    
    // Primeiro fazer login para obter token válido
    console.log('🔐 Fazendo login para obter token...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Token obtido:', token.substring(0, 50) + '...');
    
    // Testar se o serviço está respondendo
    const response = await axios.get('http://localhost:3007/api/companies', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Companies service está funcionando!');
    console.log('📋 Resposta:', response.data);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
  }
}

testCompaniesService(); 