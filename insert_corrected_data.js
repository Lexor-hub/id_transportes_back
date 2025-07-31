const mysql = require('mysql2/promise');
require('dotenv').config();

async function insertCorrectedData() {
  let connection;
  
  try {
    console.log('🔧 Conectando ao banco de dados...');
    
    connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      port: process.env.DB_PORT
    });
    
    console.log('✅ Conectado ao banco de dados');
    
    // Ler arquivo SQL corrigido
    const fs = require('fs');
    const sqlContent = fs.readFileSync('./test_data_corrected.sql', 'utf8');
    
    // Dividir em comandos individuais
    const commands = sqlContent
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => {
        const cleanCmd = cmd.replace(/--.*$/gm, '').trim();
        return cleanCmd.length > 0 && !cleanCmd.startsWith('--');
      });
    
    console.log(`📝 Executando ${commands.length} comandos SQL corrigidos...`);
    
    // Executar cada comando
    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      if (command.trim()) {
        try {
          const cleanCommand = command.replace(/--.*$/gm, '').trim();
          if (cleanCommand) {
            await connection.execute(cleanCommand);
            console.log(`✅ Comando ${i + 1} executado com sucesso`);
          }
        } catch (error) {
          console.log(`⚠️ Comando ${i + 1} falhou: ${error.message}`);
        }
      }
    }
    
    console.log('\n🎉 Dados corrigidos inseridos com sucesso!');
    console.log('\n📋 Resumo dos dados criados:');
    console.log('- 2 empresas (ID Transportes + Transportes Rápidos)');
    console.log('- 10 usuários (diferentes tipos incluindo motoristas)');
    console.log('- 5 veículos');
    console.log('- 4 motoristas');
    
    console.log('\n🔐 Credenciais de teste disponíveis:');
    console.log('- MASTER: master/password');
    console.log('- ADMIN: admin/password');
    console.log('- SUPERVISOR: supervisor/password');
    console.log('- OPERATOR: operator/password');
    console.log('- CLIENT: client/password');
    console.log('- DRIVER: joao_motorista/password');
    console.log('- DRIVER: maria_motorista/password');
    console.log('- DRIVER: pedro_motorista/password');
    console.log('- ADMIN2: admin2/password');
    console.log('- DRIVER2: driver2/password');
    
    console.log('\n📖 Consulte o arquivo CREDENCIAIS_TESTE.md para mais detalhes');
    
  } catch (error) {
    console.error('❌ Erro ao inserir dados corrigidos:', error.message);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Conexão com banco fechada');
    }
  }
}

if (require.main === module) {
  insertCorrectedData();
}

module.exports = insertCorrectedData; 