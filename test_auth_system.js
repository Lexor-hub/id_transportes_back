const http = require('http');

async function testAuthSystem() {
  try {
    console.log('🧪 Testando sistema de autenticação...\n');

    // 1. Login inicial
    console.log('1️⃣ Fazendo login...');
    const loginResponse = await makeRequest('http://localhost:3000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username: 'joao_motorista',
        password: 'password'
      })
    });

    if (loginResponse.status !== 200) {
      console.error('❌ Erro no login:', loginResponse.data);
      return;
    }

    console.log('✅ Login realizado com sucesso');
    console.log('👤 Usuário:', loginResponse.data.data.user.full_name);
    console.log('🏢 Empresa atual:', loginResponse.data.data.user.company_name);
    console.log('🔑 Token temporário gerado\n');

    // 2. Listar empresas disponíveis
    console.log('2️⃣ Listando empresas disponíveis...');
    const companiesResponse = await makeRequest('http://localhost:3000/api/auth/companies', {
      headers: {
        'Authorization': `Bearer ${loginResponse.data.data.token}`
      }
    });

    if (companiesResponse.status !== 200) {
      console.error('❌ Erro ao listar empresas:', companiesResponse.data);
      return;
    }

    console.log('✅ Empresas carregadas:');
    companiesResponse.data.data.forEach(company => {
      console.log(`   - ${company.name} (ID: ${company.id})`);
    });
    console.log('');

    // 3. Selecionar empresa
    console.log('3️⃣ Selecionando empresa...');
    const selectCompanyResponse = await makeRequest('http://localhost:3000/api/auth/select-company', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${loginResponse.data.data.token}`
      },
      body: JSON.stringify({
        company_id: 1
      })
    });

    if (selectCompanyResponse.status !== 200) {
      console.error('❌ Erro ao selecionar empresa:', selectCompanyResponse.data);
      return;
    }

    console.log('✅ Empresa selecionada com sucesso');
    console.log('🔑 Novo token gerado (com company_id)');
    console.log('👤 Usuário final:', selectCompanyResponse.data.data.user.full_name);
    console.log('🏢 Empresa selecionada:', selectCompanyResponse.data.data.user.company_id);
    console.log('');

    // 4. Testar perfil do usuário
    console.log('4️⃣ Obtendo perfil do usuário...');
    const profileResponse = await makeRequest('http://localhost:3000/api/auth/profile', {
      headers: {
        'Authorization': `Bearer ${selectCompanyResponse.data.data.token}`
      }
    });

    if (profileResponse.status !== 200) {
      console.error('❌ Erro ao obter perfil:', profileResponse.data);
      return;
    }

    console.log('✅ Perfil obtido com sucesso');
    console.log('👤 Nome:', profileResponse.data.data.full_name);
    console.log('📧 Email:', profileResponse.data.data.email);
    console.log('🏢 Empresa:', profileResponse.data.data.company_name);
    console.log('');

    console.log('🎉 Sistema de autenticação funcionando corretamente!');

  } catch (error) {
    console.error('❌ Erro no teste:', error.message);
  }
}

function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const requestOptions = {
      hostname: urlObj.hostname,
      port: urlObj.port,
      path: urlObj.pathname,
      method: options.method || 'GET',
      headers: options.headers || {}
    };

    const req = http.request(requestOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          const jsonData = JSON.parse(data);
          resolve({
            status: res.statusCode,
            data: jsonData
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data
          });
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (options.body) {
      req.write(options.body);
    }

    req.end();
  });
}

testAuthSystem(); 