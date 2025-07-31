const axios = require('axios');

async function testLogin() {
  try {
    console.log('🔐 Testando login do usuário admin...');
    
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });

    console.log('✅ Login realizado com sucesso!');
    console.log('📋 Dados do usuário:', response.data.user);
    console.log('🔑 Token JWT:', response.data.token.substring(0, 50) + '...');
    
    // Testar endpoint de listagem de usuários
    console.log('\n📋 Testando listagem de usuários...');
    const usersResponse = await axios.get('http://localhost:3001/api/users', {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });
    
    console.log('✅ Listagem de usuários funcionando!');
    console.log('👥 Usuários encontrados:', usersResponse.data.length);
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
  }
}

testLogin(); 