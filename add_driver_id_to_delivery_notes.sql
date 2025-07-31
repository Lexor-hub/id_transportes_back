-- Script para adicionar a coluna driver_id à tabela delivery_notes
-- Execute este script no banco de dados id_transportes

USE id_transportes;

-- Adicionar coluna driver_id à tabela delivery_notes (com verificação)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'delivery_notes'
     AND COLUMN_NAME = 'driver_id') = 0,
    'ALTER TABLE delivery_notes ADD COLUMN driver_id INT NULL',
    'SELECT "driver_id column already exists in delivery_notes table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar chave estrangeira para driver_id (com verificação)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'delivery_notes'
     AND COLUMN_NAME = 'driver_id'
     AND REFERENCED_TABLE_NAME = 'users') = 0,
    'ALTER TABLE delivery_notes ADD CONSTRAINT fk_delivery_notes_driver_id FOREIGN KEY (driver_id) REFERENCES users(id)',
    'SELECT "driver_id foreign key already exists in delivery_notes table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Criar índice para driver_id (com verificação)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'delivery_notes'
     AND INDEX_NAME = 'idx_delivery_notes_driver_id') = 0,
    'CREATE INDEX idx_delivery_notes_driver_id ON delivery_notes(driver_id)',
    'SELECT "idx_delivery_notes_driver_id index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

COMMIT; 