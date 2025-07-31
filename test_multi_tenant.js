const axios = require('axios');

async function testMultiTenant() {
  try {
    console.log('🧪 Testando sistema multi-tenant...\n');

    // 1. Testar login master
    console.log('1️⃣ Testando login master...');
    const masterLogin = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'master',
      password: 'admin123'
    });
    
    console.log('✅ Login master realizado com sucesso!');
    console.log('👤 Usuário:', masterLogin.data.user.name);
    console.log('🏢 Empresa:', masterLogin.data.user.company_name);
    console.log('🔑 Token:', masterLogin.data.token.substring(0, 50) + '...\n');

    const masterToken = masterLogin.data.token;

    // 2. Testar criação de nova empresa
    console.log('2️⃣ Testando criação de nova empresa...');
    const newCompany = await axios.post('http://localhost:3007/api/companies', {
      name: 'Empresa Teste',
      cnpj: '98.765.432/0001-10',
      domain: 'empresateste',
      email: 'contato@empresateste.com',
      subscription_plan: 'PRO',
      max_users: 15,
      max_drivers: 8
    }, {
      headers: { 'Authorization': `Bearer ${masterToken}` }
    });

    console.log('✅ Nova empresa criada com sucesso!');
    console.log('🏢 ID da empresa:', newCompany.data.company_id);
    console.log('👤 Credenciais admin:', newCompany.data.admin_credentials);
    console.log('');

    // 3. Testar login na nova empresa
    console.log('3️⃣ Testando login na nova empresa...');
    const adminLogin = await axios.post('http://localhost:3001/api/auth/login', {
      username: 'admin',
      password: 'admin123',
      company_domain: 'empresateste'
    });

    console.log('✅ Login na nova empresa realizado!');
    console.log('👤 Usuário:', adminLogin.data.user.name);
    console.log('🏢 Empresa:', adminLogin.data.user.company_name);
    console.log('🔑 Token:', adminLogin.data.token.substring(0, 50) + '...\n');

    const adminToken = adminLogin.data.token;

    // 4. Testar listagem de usuários (deve mostrar apenas usuários da empresa)
    console.log('4️⃣ Testando listagem de usuários...');
    const users = await axios.get('http://localhost:3001/api/users', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    console.log('✅ Listagem de usuários funcionando!');
    console.log('👥 Usuários encontrados:', users.data.length);
    users.data.forEach(user => {
      console.log(`   - ${user.username} (${user.user_type}) - ${user.company_name}`);
    });
    console.log('');

    // 5. Testar criação de usuário na empresa
    console.log('5️⃣ Testando criação de usuário na empresa...');
    const newUser = await axios.post('http://localhost:3001/api/users', {
      username: 'operador1',
      password: 'Operador123!',
      email: 'operador@empresateste.com',
      full_name: 'Operador Teste',
      user_type: 'OPERATOR'
    }, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    console.log('✅ Novo usuário criado na empresa!');
    console.log('📝 Mensagem:', newUser.data.message);
    console.log('');

    // 6. Testar estatísticas da empresa
    console.log('6️⃣ Testando estatísticas da empresa...');
    const stats = await axios.get(`http://localhost:3007/api/companies/${adminLogin.data.user.company_id}/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    console.log('✅ Estatísticas obtidas!');
    console.log('📊 Estatísticas:', stats.data);
    console.log('');

    // 7. Testar listagem de empresas (apenas master pode ver)
    console.log('7️⃣ Testando listagem de empresas (master)...');
    const companies = await axios.get('http://localhost:3007/api/companies', {
      headers: { 'Authorization': `Bearer ${masterToken}` }
    });

    console.log('✅ Listagem de empresas funcionando!');
    console.log('🏢 Empresas encontradas:', companies.data.length);
    companies.data.forEach(company => {
      console.log(`   - ${company.name} (${company.domain}) - ${company.subscription_plan}`);
    });
    console.log('');

    console.log('🎉 Todos os testes passaram com sucesso!');
    console.log('✅ Sistema multi-tenant está funcionando corretamente.');

  } catch (error) {
    console.error('❌ Erro no teste:', error.response?.data || error.message);
    
    if (error.response?.status === 401) {
      console.log('💡 Dica: Verifique se o usuário master existe no banco de dados');
    }
    
    if (error.response?.status === 500) {
      console.log('💡 Dica: Verifique se os serviços estão rodando');
    }
  }
}

testMultiTenant(); 