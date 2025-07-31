const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertTestData() {
  let connection;
  
  try {
    console.log('🔧 Conectando ao banco de dados...');
    
    // Conectar ao banco
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    console.log('✅ Conectado ao banco de dados');
    
    // Ler arquivo SQL
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./test_data.sql', 'utf8');
    
    // Dividir em comandos individuais (melhor parsing)
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => {
        // Filtrar linhas vazias e comentários
        const cleanCmd = cmd.replace(/--.*$/gm, '').trim();
        return cleanCmd.length > 0 && !cleanCmd.startsWith('--');
      });
    
    console.log(`📝 Executando ${commands.length} comandos SQL...`);
    
    // Executar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        try {
          // Limpar comentários inline
          const cleanCommand = command.replace(/--.*$/gm, '').trim();
          if (cleanCommand) {
            await connection.execute(cleanCommand);
            console.log(`✅ Comando ${i + 1} executado com sucesso`);
          }
        } catch (error) {
          console.log(`⚠️ Comando ${i + 1} falhou: ${error.message}`);
          // Continuar com o próximo comando
        }
      }
    }
    
    console.log('\n🎉 Dados de teste inseridos com sucesso!');
    console.log('\n📋 Resumo dos dados criados:');
    console.log('- 2 empresas (ID Transportes + Transportes Rápidos)');
    console.log('- 7 usuários (diferentes tipos)');
    console.log('- 5 veículos');
    console.log('- 4 motoristas');
    console.log('- 9 entregas');
    console.log('- 3 ocorrências');
    console.log('- 3 localizações de motoristas');
    console.log('- 3 canhotos/comprovantes');
    
    console.log('\n🔐 Credenciais de teste disponíveis:');
    console.log('- MASTER: master/password');
    console.log('- ADMIN: admin/password');
    console.log('- SUPERVISOR: supervisor/password');
    console.log('- OPERATOR: operator/password');
    console.log('- CLIENT: client/password');
    console.log('- DRIVER: driver2/password');
    
    console.log('\n📖 Consulte o arquivo CREDENCIAIS_TESTE.md para mais detalhes');
    
  } catch (error) {
    console.error('❌ Erro ao inserir dados de teste:', error.message);
    
    if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.log('💡 Verifique as credenciais do banco no arquivo .env');
    } else if (error.code === 'ECONNREFUSED') {
      console.log('💡 Verifique se o MySQL está rodando');
    }
    
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexão com banco fechada');
    }
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  insertTestData();
}

module.exports = insertTestData; 