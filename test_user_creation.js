const axios = require('axios');

// Teste específico para criação de usuários
async function testUserCreation() {
  console.log('=== TESTE DE CRIAÇÃO DE USUÁRIOS ===\n');
  
  try {
    // 1. Fazer login como master
    console.log('1. Fazendo login como usuário master...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'master',
      password: 'password'
    });
    
    if (!loginResponse.data.success) {
      throw new Error('Falha no login: ' + loginResponse.data.error);
    }
    
    const tempToken = loginResponse.data.data.token;
    console.log('   ✓ Login realizado com sucesso!');
    
    // 2. Selecionar empresa
    console.log('\n2. Selecionando empresa...');
    const selectResponse = await axios.post('http://localhost:3000/api/auth/select-company', {
      company_id: 1
    }, {
      headers: {
        'Authorization': `Bearer ${tempToken}`
      }
    });
    
    if (!selectResponse.data.success) {
      throw new Error('Falha na seleção de empresa: ' + selectResponse.data.error);
    }
    
    const finalToken = selectResponse.data.data.token;
    console.log('   ✓ Empresa selecionada com sucesso!');
    
    // 3. Testar criação de usuário na porta 3001 (auth-users-service)
    console.log('\n3. Testando criação de usuário na porta 3001...');
    
    const newUser = {
      username: 'teste_usuario_' + Date.now(),
      password: 'MinhaSenh@123',
      email: 'teste@idtransportes.com',
      full_name: 'Usuário de Teste',
      user_type: 'OPERATOR',
      company_id: 1  // Incluindo o company_id da empresa selecionada
    };
    
    console.log(`   Dados do usuário: ${JSON.stringify(newUser, null, 2)}`);
    
    const createUserResponse = await axios.post('http://localhost:3001/api/users', newUser, {
      headers: {
        'Authorization': `Bearer ${finalToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('\n4. Resultado da criação:');
    console.log(`   Status: ${createUserResponse.status}`);
    console.log(`   Resposta: ${JSON.stringify(createUserResponse.data, null, 2)}`);
    
    if (createUserResponse.status === 201) {
      console.log('\n✅ USUÁRIO CRIADO COM SUCESSO!');
      
      // 5. Verificar se o usuário foi criado listando usuários
      console.log('\n5. Verificando se o usuário foi criado...');
      const listUsersResponse = await axios.get('http://localhost:3001/api/users', {
        headers: {
          'Authorization': `Bearer ${finalToken}`
        }
      });
      
      const users = listUsersResponse.data;
      const createdUser = users.find(u => u.username === newUser.username);
      
      if (createdUser) {
        console.log('   ✓ Usuário encontrado na lista!');
        console.log(`   ID: ${createdUser.id}`);
        console.log(`   Username: ${createdUser.username}`);
        console.log(`   Email: ${createdUser.email}`);
        console.log(`   Nome: ${createdUser.full_name}`);
        console.log(`   Tipo: ${createdUser.user_type}`);
      } else {
        console.log('   ⚠️ Usuário não encontrado na lista');
      }
    }
    
    console.log('\n=== TESTE CONCLUÍDO COM SUCESSO! ===');
    console.log('\n🎯 DIAGNÓSTICO PARA O FRONTEND:');
    console.log('1. O backend está funcionando corretamente');
    console.log('2. O endpoint de criação está na porta 3001: POST /api/users');
    console.log('3. É necessário token válido com empresa selecionada');
    console.log('4. Verifique se o frontend está usando a porta correta');
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:');
    console.error(`Mensagem: ${error.message}`);
    
    if (error.response) {
      console.error(`Status HTTP: ${error.response.status}`);
      console.error(`URL: ${error.config?.url}`);
      console.error(`Dados: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    console.log('\n🔧 POSSÍVEIS CAUSAS DOS ERROS NO FRONTEND:');
    console.log('1. Frontend tentando acessar porta errada (deve ser 3001)');
    console.log('2. Token inválido ou expirado');
    console.log('3. Usuário não completou o fluxo de autenticação');
    console.log('4. Dados do formulário com formato incorreto');
    console.log('5. Problemas de CORS entre frontend e backend');
    
    console.log('\n📋 VERIFICAÇÕES RECOMENDADAS:');
    console.log('1. Verificar se o frontend usa: http://localhost:3001/api/users');
    console.log('2. Verificar se o token está sendo enviado corretamente');
    console.log('3. Verificar se o usuário fez login e selecionou empresa');
    console.log('4. Verificar logs do navegador (F12 > Console)');
    console.log('5. Verificar logs do backend (terminal do auth-users-service)');
  }
}

// Executar o teste
testUserCreation();