const axios = require('axios');

async function testEndpoints() {
  try {
    // Login
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123',
      company_domain: 'idtransportes'
    });
    
    const token = loginResponse.data.token;
    console.log('✅ Login OK');

    // Testar KPIs
    try {
      const kpisResponse = await axios.get('http://localhost:3006/api/dashboard/kpis', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ KPIs OK:', kpisResponse.data);
    } catch (error) {
      console.log('❌ KPIs Error:', error.response?.status, error.response?.data);
    }

    // Testar ocorrências
    try {
      const occurrencesResponse = await axios.get('http://localhost:3003/api/occurrences', {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Ocorrências OK:', occurrencesResponse.data);
    } catch (error) {
      console.log('❌ Ocorrências Error:', error.response?.status, error.response?.data);
    }

    // Testar rastreamento
    try {
      const trackingResponse = await axios.post('http://localhost:3005/api/tracking/location', {
        driver_id: 2,
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 10,
        speed: 50,
        heading: 90
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      console.log('✅ Rastreamento OK:', trackingResponse.data);
    } catch (error) {
      console.log('❌ Rastreamento Error:', error.response?.status, error.response?.data);
    }

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testEndpoints(); 