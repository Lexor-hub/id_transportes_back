const axios = require('axios');

async function testLogin() {
  try {
    console.log('🔐 Testando login...');
    
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123',
      company_domain: 'idtransportes'
    });
    
    console.log('✅ Login bem-sucedido!');
    console.log('👤 Usuário:', response.data.user.username);
    console.log('🏢 Empresa:', response.data.user.company_name);
    console.log('🔑 Token:', response.data.token.substring(0, 50) + '...');
    
    // Testar token
    const tokenResponse = await axios.get('http://localhost:3001/api/users', {
      headers: {
        'Authorization': `Bearer ${response.data.token}`
      }
    });
    
    console.log('✅ Token válido!');
    console.log('📊 Usuários encontrados:', tokenResponse.data.length);
    
  } catch (error) {
    console.error('❌ Erro no login:', error.response?.data || error.message);
    
    if (error.response?.status === 500) {
      console.log('💡 Dica: Verifique se o serviço está rodando na porta 3001');
      console.log('💡 Dica: Verifique se o arquivo .env está configurado');
    }
  }
}

testLogin(); 