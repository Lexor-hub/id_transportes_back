const axios = require('axios');

async function checkService() {
  try {
    console.log('🔍 Verificando serviço de autenticação...');
    
    // Testar se o serviço está respondendo
    const response = await axios.get('http://localhost:3001/api-docs', {
      timeout: 5000
    });
    
    console.log('✅ Serviço está rodando na porta 3001');
    console.log('📚 Swagger UI disponível em: http://localhost:3001/api-docs');
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.log('❌ Serviço não está rodando na porta 3001');
      console.log('💡 Execute: cd services/auth-users-service && node index.js');
    } else if (error.code === 'ENOTFOUND') {
      console.log('❌ Não foi possível conectar ao localhost:3001');
    } else {
      console.log('❌ Erro ao conectar:', error.message);
    }
  }
}

checkService(); 