const axios = require('axios');

async function simpleTest() {
  try {
    console.log('🔐 Testando login simples...');
    
    const response = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123',
      company_domain: 'idtransportes'
    });
    
    console.log('✅ SUCESSO! Login funcionando!');
    console.log('👤 Usuário:', response.data.user.username);
    console.log('🏢 Empresa:', response.data.user.company_name);
    console.log('🔑 Token:', response.data.token.substring(0, 50) + '...');
    
  } catch (error) {
    console.error('❌ ERRO DETALHADO:');
    console.error('- Status:', error.response?.status);
    console.error('- Data:', error.response?.data);
    console.error('- Message:', error.message);
    console.error('- Code:', error.code);
  }
}

simpleTest(); 