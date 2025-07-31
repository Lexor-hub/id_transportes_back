const pool = require('./shared/db');

async function addMissingColumnsToTrackingPoints() {
  try {
    console.log('🔧 Adicionando colunas faltantes à tabela tracking_points...');
    
    const columnsToAdd = [
      { name: 'accuracy', type: 'DECIMAL(5,2)', nullable: 'NULL' },
      { name: 'speed', type: 'DECIMAL(5,2)', nullable: 'NULL' },
      { name: 'heading', type: 'DECIMAL(5,2)', nullable: 'NULL' },
      { name: 'delivery_id', type: 'INT', nullable: 'NULL' }
    ];
    
    for (const column of columnsToAdd) {
      // Verificar se a coluna já existe
      const [columns] = await pool.query(`
        SELECT COUNT(*) as column_exists
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'id_transportes'
        AND TABLE_NAME = 'tracking_points'
        AND COLUMN_NAME = ?
      `, [column.name]);
      
      if (columns[0].column_exists > 0) {
        console.log(`✅ Coluna ${column.name} já existe`);
        continue;
      }
      
      // Adicionar a coluna
      await pool.query(`ALTER TABLE tracking_points ADD COLUMN ${column.name} ${column.type} ${column.nullable}`);
      console.log(`✅ Coluna ${column.name} adicionada com sucesso`);
    }
    
    // Adicionar chave estrangeira para delivery_id se não existir
    const [foreignKeys] = await pool.query(`
      SELECT COUNT(*) as fk_exists
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = 'id_transportes'
      AND TABLE_NAME = 'tracking_points'
      AND COLUMN_NAME = 'delivery_id'
      AND CONSTRAINT_NAME LIKE '%fk%'
    `);
    
    if (foreignKeys[0].fk_exists === 0) {
      await pool.query('ALTER TABLE tracking_points ADD CONSTRAINT fk_tracking_points_delivery_id FOREIGN KEY (delivery_id) REFERENCES delivery_notes(id)');
      console.log('✅ Chave estrangeira para delivery_id adicionada');
    }
    
    // Criar índices
    await pool.query('CREATE INDEX idx_tracking_points_accuracy ON tracking_points(accuracy)');
    await pool.query('CREATE INDEX idx_tracking_points_speed ON tracking_points(speed)');
    await pool.query('CREATE INDEX idx_tracking_points_heading ON tracking_points(heading)');
    await pool.query('CREATE INDEX idx_tracking_points_delivery_id ON tracking_points(delivery_id)');
    console.log('✅ Índices criados com sucesso');
    
    // Verificar a estrutura atualizada
    const [updatedColumns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'id_transportes'
      AND TABLE_NAME = 'tracking_points'
      AND COLUMN_NAME IN ('accuracy', 'speed', 'heading', 'delivery_id')
      ORDER BY COLUMN_NAME
    `);
    
    console.log('✅ Verificação das colunas adicionadas:');
    updatedColumns.forEach(col => {
      console.log(`   - ${col.COLUMN_NAME}: ${col.DATA_TYPE} (${col.IS_NULLABLE})`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao adicionar colunas:', error);
  } finally {
    await pool.end();
  }
}

addMissingColumnsToTrackingPoints(); 