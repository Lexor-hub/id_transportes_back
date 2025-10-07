const axios = require('axios');

// Configuração da API
const API_BASE = 'http://localhost:3001';

async function testDeleteUser() {
  console.log('=== TESTE DE EXCLUSÃO DE USUÁRIO ===\n');
  
  try {
    // 1. Fazer login para obter token
    console.log('1. Fazendo login como master...');
    const loginResponse = await axios.post(`${API_BASE}/api/auth/login`, {
      username: 'master',
      password: 'password',
      company_domain: 'idtransportes'
    });
    
    if (loginResponse.status !== 200) {
      throw new Error('Falha no login');
    }
    
    const token = loginResponse.data.token;
    console.log('✅ Login realizado com sucesso');
    
    // 2. Listar usuários antes da exclusão
    console.log('\n2. Listando usuários antes da exclusão...');
    const usersBeforeResponse = await axios.get(`${API_BASE}/api/users`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    const usersBefore = usersBeforeResponse.data;
    console.log(`✅ Total de usuários antes: ${usersBefore.length}`);
    
    // Encontrar um usuário para testar (que não seja o master)
    const testUser = usersBefore.find(user => user.username !== 'master');
    
    if (!testUser) {
      console.log('⚠️  Nenhum usuário disponível para teste (além do master)');
      
      // Criar um usuário de teste
      console.log('\n3. Criando usuário de teste...');
      const createResponse = await axios.post(`${API_BASE}/api/users`, {
        username: 'usuario_teste_exclusao',
        password: 'TestPass123',
        email: 'teste@exclusao.com',
        full_name: 'Usuário Teste Exclusão',
        user_type: 'OPERATOR',
        company_id: 1
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (createResponse.status === 201) {
        console.log('✅ Usuário de teste criado com sucesso');
        
        // Listar novamente para pegar o ID do usuário criado
        const usersAfterCreateResponse = await axios.get(`${API_BASE}/api/users`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        const createdUser = usersAfterCreateResponse.data.find(user => user.username === 'usuario_teste_exclusao');
        
        if (createdUser) {
          console.log(`\n4. Testando exclusão do usuário: ${createdUser.username} (ID: ${createdUser.id})`);
          
          // Tentar excluir o usuário
          const deleteResponse = await axios.delete(`${API_BASE}/api/users/${createdUser.id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });
          
          if (deleteResponse.status === 200) {
            console.log('✅ Usuário excluído com sucesso!');
            console.log('📝 Resposta:', deleteResponse.data.message);
            
            // Verificar se o usuário foi realmente excluído
            console.log('\n5. Verificando se o usuário foi excluído...');
            const usersAfterDeleteResponse = await axios.get(`${API_BASE}/api/users`, {
              headers: { Authorization: `Bearer ${token}` }
            });
            
            const usersAfter = usersAfterDeleteResponse.data;
            const deletedUserExists = usersAfter.find(user => user.id === createdUser.id);
            
            if (!deletedUserExists) {
              console.log('✅ Confirmado: Usuário foi excluído permanentemente do banco de dados');
              console.log(`📊 Total de usuários após exclusão: ${usersAfter.length}`);
            } else {
              console.log('❌ Erro: Usuário ainda existe no banco de dados');
            }
          } else {
            console.log('❌ Falha na exclusão do usuário');
          }
        }
      } else {
        console.log('❌ Falha ao criar usuário de teste');
      }
    } else {
      console.log(`\n3. Usuário encontrado para teste: ${testUser.username} (ID: ${testUser.id})`);
      console.log('⚠️  ATENÇÃO: Este teste excluirá permanentemente um usuário real!');
      console.log('⚠️  Para segurança, o teste será interrompido aqui.');
      console.log('⚠️  Para testar com usuário real, modifique o script.');
    }
    
    console.log('\n=== TESTE CONCLUÍDO ===');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.response?.data || error.message);
    
    if (error.response) {
      console.error('📝 Status:', error.response.status);
      console.error('📝 Dados:', error.response.data);
    }
  }
}

// Executar o teste
testDeleteUser();