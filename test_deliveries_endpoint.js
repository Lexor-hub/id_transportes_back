const axios = require('axios');

async function testDeliveriesEndpoint() {
  try {
    console.log('🧪 Testando endpoint de entregas...');
    
    // Primeiro, fazer login para obter o token
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'joao_motorista',
      password: 'password',
      company_domain: 'idtransportes'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso');
    
    // Testar o endpoint de entregas com driver_id=16 (joao_motorista)
    const deliveriesResponse = await axios.get('http://localhost:3003/api/deliveries?driver_id=16', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Endpoint de entregas funcionando!');
    console.log('📋 Resposta:', JSON.stringify(deliveriesResponse.data, null, 2));
    
    // Testar sem filtro de driver_id
    const allDeliveriesResponse = await axios.get('http://localhost:3003/api/deliveries', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Endpoint sem filtro funcionando!');
    console.log('📊 Total de entregas:', allDeliveriesResponse.data.data.length);
    
  } catch (error) {
    console.error('❌ Erro ao testar endpoint:', error.response?.data || error.message);
  }
}

testDeliveriesEndpoint(); 