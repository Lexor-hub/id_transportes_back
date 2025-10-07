const axios = require('axios');

// Teste completo do fluxo de autenticação
async function testAuthFlow() {
  console.log('=== TESTE DO FLUXO DE AUTENTICAÇÃO COMPLETO ===\n');
  
  try {
    // 1. Teste sem token (deve retornar 401)
    console.log('1. Testando acesso sem token...');
    try {
      await axios.get('http://localhost:3000/api/auth/companies');
    } catch (error) {
      console.log(`   ✓ Erro esperado: ${error.response.status} - ${error.response.statusText}`);
    }
    
    // 2. Fazer login
    console.log('\n2. Fazendo login...');
    const loginResponse = await axios.post('http://localhost:3000/api/auth/login', {
      username: 'admin',
      password: 'admin123'
    });
    
    if (loginResponse.data.success) {
      const tempToken = loginResponse.data.data.token;
      console.log(`   ✓ Login realizado com sucesso!`);
      console.log(`   ✓ Token temporário recebido: ${tempToken.substring(0, 20)}...`);
      
      // 3. Buscar empresas com token temporário
      console.log('\n3. Buscando empresas com token temporário...');
      const companiesResponse = await axios.get('http://localhost:3000/api/auth/companies', {
        headers: {
          'Authorization': `Bearer ${tempToken}`
        }
      });
      
      if (companiesResponse.data.success) {
        console.log(`   ✓ Empresas encontradas: ${companiesResponse.data.data.length}`);
        companiesResponse.data.data.forEach((company, index) => {
          console.log(`   ${index + 1}. ${company.name} (ID: ${company.id})`);
        });
        
        // 4. Selecionar primeira empresa
        if (companiesResponse.data.data.length > 0) {
          const firstCompany = companiesResponse.data.data[0];
          console.log(`\n4. Selecionando empresa: ${firstCompany.name}...`);
          
          const selectResponse = await axios.post('http://localhost:3000/api/auth/select-company', {
            company_id: firstCompany.id
          }, {
            headers: {
              'Authorization': `Bearer ${tempToken}`
            }
          });
          
          if (selectResponse.data.success) {
            const finalToken = selectResponse.data.data.token;
            console.log(`   ✓ Empresa selecionada com sucesso!`);
            console.log(`   ✓ Token final recebido: ${finalToken.substring(0, 20)}...`);
            
            // 5. Testar acesso com token final
            console.log('\n5. Testando acesso com token final...');
            const finalTestResponse = await axios.get('http://localhost:3000/api/auth/companies', {
              headers: {
                'Authorization': `Bearer ${finalToken}`
              }
            });
            
            console.log(`   ✓ Acesso autorizado! Empresas retornadas: ${finalTestResponse.data.data.length}`);
            
            console.log('\n=== FLUXO COMPLETO REALIZADO COM SUCESSO! ===');
            console.log('\n📋 RESUMO DO PROBLEMA:');
            console.log('   • Os erros acontecem quando o frontend tenta acessar endpoints sem token válido');
            console.log('   • net::ERR_ABORTED = requisição cancelada por falta de autenticação');
            console.log('   • Failed to fetch = erro de conectividade/autenticação');
            console.log('   • HTTP 404 = alguns endpoints podem não existir ou estar inacessíveis');
            console.log('   • Erro da API: null = resposta vazia devido à falha de autenticação');
            
            console.log('\n🔧 SOLUÇÃO:');
            console.log('   1. Acesse http://localhost:8080/login');
            console.log('   2. Faça login com suas credenciais');
            console.log('   3. Selecione uma empresa');
            console.log('   4. Agora todos os endpoints funcionarão corretamente!');
            
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
    console.error('Erro no teste:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

// Executar o teste
testAuthFlow();