const pool = require('./shared/db');

async function checkDeliveryNotesStructure() {
  try {
    console.log('🔍 Verificando estrutura da tabela delivery_notes...');
    
    // Verificar se a coluna driver_id existe
    const [columns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'id_transportes'
      AND TABLE_NAME = 'delivery_notes'
      ORDER BY ORDINAL_POSITION
    `);
    
    console.log('📋 Colunas da tabela delivery_notes:');
    columns.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });
    
    // Verificar se há dados na tabela
    const [data] = await pool.query('SELECT COUNT(*) as total FROM delivery_notes');
    console.log(`📊 Total de registros na tabela delivery_notes: ${data[0].total}`);
    
    // Verificar alguns registros de exemplo
    const [sampleData] = await pool.query('SELECT * FROM delivery_notes LIMIT 3');
    console.log('📋 Dados de exemplo:');
    sampleData.forEach((row, index) => {
      console.log(`  Registro ${index + 1}:`, row);
    });
    
  } catch (error) {
    console.error('❌ Erro ao verificar estrutura:', error);
  } finally {
    await pool.end();
  }
}

checkDeliveryNotesStructure(); 