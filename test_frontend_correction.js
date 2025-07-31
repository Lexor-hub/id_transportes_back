const axios = require('axios');

async function testFrontendCorrection() {
  try {
    console.log('🔐 Testando fluxo completo de autenticação...');
    
    // 1. Login
    console.log('\n1️⃣ Fazendo login...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'joao_motorista',
      password: 'password'
    });
    
    const token = loginResponse.data.data.token;
    console.log('✅ Login realizado com sucesso');
    
    // 2. Listar empresas (porta correta)
    console.log('\n2️⃣ Listando empresas (porta 3000)...');
    const companiesResponse = await axios.get('http://localhost:3000/api/auth/companies', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Companies carregadas com sucesso:');
    console.log(JSON.stringify(companiesResponse.data, null, 2));
    
    // 3. Selecionar empresa
    console.log('\n3️⃣ Selecionando empresa...');
    const selectCompanyResponse = await axios.post('http://localhost:3000/api/auth/select-company', {
      company_id: 1
    }, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Empresa selecionada com sucesso');
    
    // 4. Obter perfil
    console.log('\n4️⃣ Obtendo perfil do usuário...');
    const profileResponse = await axios.get('http://localhost:3000/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('✅ Perfil obtido com sucesso:');
    console.log(JSON.stringify(profileResponse.data, null, 2));
    
    console.log('\n🎉 Todos os endpoints estão funcionando corretamente!');
    console.log('📝 Use estas URLs no seu frontend:');
    console.log('   - Login: http://localhost:3000/api/auth/login');
    console.log('   - Companies: http://localhost:3000/api/auth/companies');
    console.log('   - Select Company: http://localhost:3000/api/auth/select-company');
    console.log('   - Profile: http://localhost:3000/api/auth/profile');
    
  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
  }
}

testFrontendCorrection(); 