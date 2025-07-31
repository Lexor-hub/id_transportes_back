const axios = require('axios');

async function debugJWTService() {
  try {
    console.log('🔍 Debugando serviço de autenticação...');
    
    // Fazer uma requisição para verificar se o JWT_SECRET está sendo carregado
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123',
      company_domain: 'idtransportes'
    }, {
      timeout: 10000
    });
    
    console.log('✅ Login bem-sucedido!');
    console.log('👤 Usuário:', response.data.user.username);
    console.log('🔑 Token:', response.data.token.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('❌ Erro detalhado:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message,
      code: error.code
    });
    
    if (error.response?.data?.error === 'secretOrPrivateKey must have a value') {
      console.log('💡 O JWT_SECRET não está sendo carregado no serviço');
      console.log('💡 Verifique se o arquivo .env está na raiz do projeto');
      console.log('💡 Verifique se o serviço está carregando o .env corretamente');
    }
  }
}

debugJWTService(); 