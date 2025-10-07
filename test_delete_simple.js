// Script simples para testar exclusão de usuário
const pool = require('./shared/db');

async function testDeleteUserDirect() {
  console.log('=== TESTE DIRETO DE EXCLUSÃO NO BANCO ===\n');
  
  try {
    // 1. Criar um usuário de teste diretamente no banco
    console.log('1. Criando usuário de teste no banco...');
    const bcrypt = require('bcrypt');
    const passwordHash = await bcrypt.hash('TestPass123', 10);
    
    const [insertResult] = await pool.query(
      'INSERT INTO users (company_id, username, password_hash, email, full_name, user_type) VALUES (?, ?, ?, ?, ?, ?)',
      [1, 'usuario_teste_delete', passwordHash, 'teste@delete.com', 'Usuário Teste Delete', 'OPERATOR']
    );
    
    const testUserId = insertResult.insertId;
    console.log(`✅ Usuário criado com ID: ${testUserId}`);
    
    // 2. Verificar se o usuário foi criado
    console.log('\n2. Verificando se o usuário foi criado...');
    const [usersBefore] = await pool.query('SELECT * FROM users WHERE id = ?', [testUserId]);
    
    if (usersBefore.length > 0) {
      console.log('✅ Usuário encontrado no banco:', usersBefore[0].username);
      
      // 3. Excluir o usuário usando DELETE
      console.log('\n3. Excluindo usuário do banco...');
      const [deleteResult] = await pool.query('DELETE FROM users WHERE id = ?', [testUserId]);
      
      console.log(`✅ Comando DELETE executado. Linhas afetadas: ${deleteResult.affectedRows}`);
      
      // 4. Verificar se o usuário foi realmente excluído
      console.log('\n4. Verificando se o usuário foi excluído...');
      const [usersAfter] = await pool.query('SELECT * FROM users WHERE id = ?', [testUserId]);
      
      if (usersAfter.length === 0) {
        console.log('✅ SUCESSO: Usuário foi excluído permanentemente do banco de dados!');
      } else {
        console.log('❌ ERRO: Usuário ainda existe no banco de dados');
      }
    } else {
      console.log('❌ Erro: Usuário não foi encontrado após criação');
    }
    
    console.log('\n=== TESTE CONCLUÍDO ===');
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    // Fechar conexão
    await pool.end();
  }
}

// Executar o teste
testDeleteUserDirect();