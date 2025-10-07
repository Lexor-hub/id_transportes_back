const axios = require('axios');

// Teste específico para login do usuário master
async function testMasterLogin() {
  console.log('=== TESTE DE LOGIN DO USUÁRIO MASTER ===\n');
  
  try {
    // Credenciais do usuário master (conforme CREDENCIAIS_TESTE.md)
    const masterCredentials = {
      username: 'master',
      password: 'password'
    };
    
    console.log('1. Testando login com credenciais master...');
    console.log(`   Usuário: ${masterCredentials.username}`);
    console.log(`   Senha: ${masterCredentials.password}`);
    
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', masterCredentials);
    
    console.log('\n2. Resposta do servidor:');
    console.log(`   Status: ${loginResponse.status}`);
    console.log(`   Success: ${loginResponse.data.success}`);
    
    if (loginResponse.data.success) {
      const { user, token } = loginResponse.data.data;
      console.log('\n3. Dados do usuário master:');
      console.log(`   ID: ${user.id}`);
      console.log(`   Username: ${user.username}`);
      console.log(`   Email: ${user.email}`);
      console.log(`   Nome: ${user.full_name}`);
      console.log(`   Tipo: ${user.user_type}`);
      console.log(`   Company ID: ${user.company_id || 'Não definido'}`);
      
      console.log('\n4. Token temporário:');
      console.log(`   Token: ${token.substring(0, 30)}...`);
      
      // Testar busca de empresas com token temporário
      console.log('\n5. Testando busca de empresas...');
      const companiesResponse = await axios.get('http://localhost:3000/api/auth/companies', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (companiesResponse.data.success) {
        console.log(`   ✓ Empresas encontradas: ${companiesResponse.data.data.length}`);
        companiesResponse.data.data.forEach((company, index) => {
          console.log(`   ${index + 1}. ${company.name} (ID: ${company.id})`);
        });
        
        // Testar seleção de empresa
        if (companiesResponse.data.data.length > 0) {
          const firstCompany = companiesResponse.data.data[0];
          console.log(`\n6. Testando seleção da empresa: ${firstCompany.name}...`);
          
          const selectResponse = await axios.post('http://localhost:3000/api/auth/select-company', {
            company_id: firstCompany.id
          }, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          
          if (selectResponse.data.success) {
            const finalToken = selectResponse.data.data.token;
            console.log(`   ✓ Empresa selecionada com sucesso!`);
            console.log(`   ✓ Token final: ${finalToken.substring(0, 30)}...`);
            
            console.log('\n=== TESTE COMPLETO - SUCESSO! ===');
            console.log('\n🎯 INSTRUÇÕES PARA O FRONTEND:');
            console.log('1. Faça login com: master / master123');
            console.log('2. Selecione a empresa: ID Transportes');
            console.log('3. O sistema deve funcionar normalmente');
            
            console.log('\n🔍 TOKENS PARA DEBUG:');
            console.log(`Temp Token: ${token}`);
            console.log(`Final Token: ${finalToken}`);
            
          } else {
            console.log(`   ✗ Erro ao selecionar empresa: ${selectResponse.data.error}`);
          }
        }
      } else {
        console.log(`   ✗ Erro ao buscar empresas: ${companiesResponse.data.error}`);
      }
      
    } else {
      console.log(`   ✗ Erro no login: ${loginResponse.data.error}`);
    }
    
  } catch (error) {
    console.error('\n❌ ERRO NO TESTE:');
    console.error(`Mensagem: ${error.message}`);
    
    if (error.response) {
      console.error(`Status HTTP: ${error.response.status}`);
      console.error(`Dados: ${JSON.stringify(error.response.data, null, 2)}`);
    }
    
    console.log('\n🔧 POSSÍVEIS CAUSAS:');
    console.log('1. Backend não está rodando na porta 3000');
    console.log('2. Credenciais do usuário master incorretas');
    console.log('3. Banco de dados não está acessível');
    console.log('4. Problemas de configuração do JWT');
  }
}

// Executar o teste
testMasterLogin();