const pool = require('./shared/db');
const fs = require('fs');

async function executeSQL() {
  try {
    console.log('🔧 Executando script SQL das melhorias...');
    
    const sqlContent = fs.readFileSync('./create_tables_improvements_fixed.sql', 'utf8');
    const statements = sqlContent.split(';').filter(stmt => stmt.trim());
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i].trim();
      if (statement) {
        try {
          await pool.query(statement);
          console.log(`✅ Executado: ${statement.substring(0, 50)}...`);
        } catch (error) {
          if (error.code === 'ER_DUP_KEYNAME' || error.code === 'ER_DUP_FIELDNAME') {
            console.log(`⚠️  Ignorado (já existe): ${statement.substring(0, 50)}...`);
          } else {
            console.error(`❌ Erro: ${error.message}`);
          }
        }
      }
    }
    
    console.log('✅ Script SQL executado com sucesso!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Erro ao executar script:', error);
    process.exit(1);
  }
}

executeSQL(); 