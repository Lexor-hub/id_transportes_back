const pool = require('./shared/db');

async function addDriverIdToTrackingPoints() {
  try {
    console.log('🔧 Adicionando coluna driver_id à tabela tracking_points...');
    
    // Verificar se a coluna já existe
    const [columns] = await pool.query(`
      SELECT COUNT(*) as column_exists
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'id_transportes'
      AND TABLE_NAME = 'tracking_points'
      AND COLUMN_NAME = 'driver_id'
    `);
    
    if (columns[0].column_exists > 0) {
      console.log('✅ Coluna driver_id já existe na tabela tracking_points');
      return;
    }
    
    // Adicionar a coluna driver_id
    await pool.query('ALTER TABLE tracking_points ADD COLUMN driver_id INT NULL');
    console.log('✅ Coluna driver_id adicionada com sucesso');
    
    // Adicionar chave estrangeira
    await pool.query('ALTER TABLE tracking_points ADD CONSTRAINT fk_tracking_points_driver_id FOREIGN KEY (driver_id) REFERENCES drivers(id)');
    console.log('✅ Chave estrangeira adicionada com sucesso');
    
    // Criar índice
    await pool.query('CREATE INDEX idx_tracking_points_driver_id ON tracking_points(driver_id)');
    console.log('✅ Índice criado com sucesso');
    
    // Verificar a estrutura atualizada
    const [updatedColumns] = await pool.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'id_transportes'
      AND TABLE_NAME = 'tracking_points'
      AND COLUMN_NAME = 'driver_id'
    `);
    
    if (updatedColumns.length > 0) {
      console.log('✅ Verificação: Coluna driver_id foi adicionada corretamente');
      console.log(`   - Tipo: ${updatedColumns[0].DATA_TYPE}`);
      console.log(`   - Nullable: ${updatedColumns[0].IS_NULLABLE}`);
    }
    
  } catch (error) {
    console.error('❌ Erro ao adicionar coluna driver_id:', error);
  } finally {
    await pool.end();
  }
}

addDriverIdToTrackingPoints(); 