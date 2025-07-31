const axios = require('axios');

const BASE_URL = 'http://localhost:3001';
const COMPANIES_URL = 'http://localhost:3007';
const RECEIPTS_URL = 'http://localhost:3004';
const TRACKING_URL = 'http://localhost:3005';
const DELIVERIES_URL = 'http://localhost:3003';
const REPORTS_URL = 'http://localhost:3006';

let authToken = '';

async function testImprovements() {
  console.log('🚀 Testando melhorias implementadas...\n');

  try {
    // 1. Login para obter token
    console.log('1. 🔐 Fazendo login...');
    const loginResponse = await axios.post(`${BASE_URL}/api/auth/login`, {
      username: 'admin',
      password: 'admin123',
      company_domain: 'idtransportes'
    });
    
    authToken = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso\n');

    // 2. Testar upload de canhoto
    console.log('2. 📸 Testando upload de canhoto...');
    try {
      const receiptResponse = await axios.post(`${RECEIPTS_URL}/api/receipts/upload`, {
        delivery_id: 1,
        driver_id: 2,
        notes: 'Teste de upload'
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Upload de canhoto funcionando');
    } catch (error) {
      console.log('⚠️  Upload de canhoto (sem arquivo):', error.response?.data?.error || error.message);
    }

    // 3. Testar listagem de canhotos
    console.log('\n3. 📋 Testando listagem de canhotos...');
    try {
      const receiptsListResponse = await axios.get(`${RECEIPTS_URL}/api/receipts`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Listagem de canhotos funcionando');
    } catch (error) {
      console.log('❌ Erro na listagem de canhotos:', error.response?.data?.error || error.message);
    }

    // 4. Testar rastreamento
    console.log('\n4. 📍 Testando rastreamento...');
    try {
      const trackingResponse = await axios.post(`${TRACKING_URL}/api/tracking/location`, {
        driver_id: 2,
        latitude: -23.5505,
        longitude: -46.6333,
        accuracy: 10,
        speed: 50,
        heading: 90
      }, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Rastreamento funcionando');
    } catch (error) {
      console.log('❌ Erro no rastreamento:', error.response?.data?.error || error.message);
    }

    // 5. Testar localizações atuais
    console.log('\n5. 🗺️ Testando localizações atuais...');
    try {
      const currentLocationsResponse = await axios.get(`${TRACKING_URL}/api/tracking/drivers/current-locations`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Localizações atuais funcionando');
    } catch (error) {
      console.log('❌ Erro nas localizações atuais:', error.response?.data?.error || error.message);
    }

    // 6. Testar ocorrências
    console.log('\n6. ⚠️ Testando ocorrências...');
    try {
      const occurrencesResponse = await axios.get(`${DELIVERIES_URL}/api/occurrences`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Listagem de ocorrências funcionando');
    } catch (error) {
      console.log('❌ Erro na listagem de ocorrências:', error.response?.data?.error || error.message);
    }

    // 7. Testar entregas
    console.log('\n7. 📦 Testando entregas...');
    try {
      const deliveriesResponse = await axios.get(`${DELIVERIES_URL}/api/deliveries`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Listagem de entregas funcionando');
    } catch (error) {
      console.log('❌ Erro na listagem de entregas:', error.response?.data?.error || error.message);
    }

    // 8. Testar relatórios
    console.log('\n8. 📊 Testando relatórios...');
    try {
      const reportsResponse = await axios.get(`${REPORTS_URL}/api/reports/deliveries`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Relatórios funcionando');
    } catch (error) {
      console.log('❌ Erro nos relatórios:', error.response?.data?.error || error.message);
    }

    // 9. Testar KPIs do dashboard
    console.log('\n9. 📈 Testando KPIs do dashboard...');
    try {
      const kpisResponse = await axios.get(`${REPORTS_URL}/api/dashboard/kpis`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ KPIs do dashboard funcionando');
    } catch (error) {
      console.log('❌ Erro nos KPIs:', error.response?.data?.error || error.message);
    }

    // 10. Testar estatísticas da empresa
    console.log('\n10. 📈 Testando estatísticas da empresa...');
    try {
      const statsResponse = await axios.get(`${REPORTS_URL}/api/dashboard/company-stats`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      console.log('✅ Estatísticas da empresa funcionando');
    } catch (error) {
      console.log('❌ Erro nas estatísticas:', error.response?.data?.error || error.message);
    }

    console.log('\n🎉 Teste das melhorias concluído!');

  } catch (error) {
    console.error('❌ Erro geral:', error.message);
  }
}

testImprovements(); 