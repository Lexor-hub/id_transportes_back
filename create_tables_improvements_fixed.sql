-- Script para criar tabelas necessárias para as melhorias do backend
-- Execute este script no banco de dados id_transportes

USE id_transportes;

-- Tabela para canhotos de entregas
CREATE TABLE IF NOT EXISTS delivery_receipts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_id INT NOT NULL,
  driver_id INT NOT NULL,
  company_id INT NOT NULL,
  filename VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL,
  notes TEXT,
  status ENUM('PENDING', 'PROCESSED', 'VALIDATED', 'ERROR') DEFAULT 'PENDING',
  ocr_data JSON,
  validated_ocr_data JSON,
  corrections JSON,
  validated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_at TIMESTAMP NULL,
  validated_at TIMESTAMP NULL,
  FOREIGN KEY (delivery_id) REFERENCES delivery_notes(id),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- Tabela para ocorrências de entregas
CREATE TABLE IF NOT EXISTS delivery_occurrences (
  id INT AUTO_INCREMENT PRIMARY KEY,
  delivery_id INT NOT NULL,
  company_id INT NOT NULL,
  driver_id INT NOT NULL,
  type ENUM('reentrega', 'recusa', 'avaria') NOT NULL,
  description TEXT NOT NULL,
  photo_url VARCHAR(500),
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (delivery_id) REFERENCES delivery_notes(id),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Tabela para pontos de rastreamento
CREATE TABLE IF NOT EXISTS tracking_points (
  id INT AUTO_INCREMENT PRIMARY KEY,
  driver_id INT NOT NULL,
  company_id INT NOT NULL,
  latitude DECIMAL(10, 8) NOT NULL,
  longitude DECIMAL(11, 8) NOT NULL,
  accuracy DECIMAL(5, 2),
  speed DECIMAL(5, 2),
  heading DECIMAL(5, 2),
  delivery_id INT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (driver_id) REFERENCES users(id),
  FOREIGN KEY (company_id) REFERENCES companies(id),
  FOREIGN KEY (delivery_id) REFERENCES delivery_notes(id),
  INDEX idx_driver_timestamp (driver_id, timestamp),
  INDEX idx_company_timestamp (company_id, timestamp)
);

-- Adicionar colunas necessárias à tabela drivers (com verificação)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'drivers'
     AND COLUMN_NAME = 'status') = 0,
    'ALTER TABLE drivers ADD COLUMN status ENUM("active", "inactive", "busy", "available") DEFAULT "active"',
    'SELECT "status column already exists in drivers table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'drivers'
     AND COLUMN_NAME = 'last_status_update') = 0,
    'ALTER TABLE drivers ADD COLUMN last_status_update TIMESTAMP NULL',
    'SELECT "last_status_update column already exists in drivers table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'drivers'
     AND COLUMN_NAME = 'last_location_lat') = 0,
    'ALTER TABLE drivers ADD COLUMN last_location_lat DECIMAL(10, 8)',
    'SELECT "last_location_lat column already exists in drivers table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'drivers'
     AND COLUMN_NAME = 'last_location_lng') = 0,
    'ALTER TABLE drivers ADD COLUMN last_location_lng DECIMAL(11, 8)',
    'SELECT "last_location_lng column already exists in drivers table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'drivers'
     AND COLUMN_NAME = 'last_location_update') = 0,
    'ALTER TABLE drivers ADD COLUMN last_location_update TIMESTAMP NULL',
    'SELECT "last_location_update column already exists in drivers table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar colunas necessárias à tabela delivery_notes (com verificação)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'delivery_notes'
     AND COLUMN_NAME = 'notes') = 0,
    'ALTER TABLE delivery_notes ADD COLUMN notes TEXT',
    'SELECT "notes column already exists in delivery_notes table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'delivery_notes'
     AND COLUMN_NAME = 'updated_at') = 0,
    'ALTER TABLE delivery_notes ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
    'SELECT "updated_at column already exists in delivery_notes table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Criar índices para melhor performance (com verificação)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'delivery_receipts'
     AND INDEX_NAME = 'idx_delivery_receipts_delivery') = 0,
    'CREATE INDEX idx_delivery_receipts_delivery ON delivery_receipts(delivery_id)',
    'SELECT "idx_delivery_receipts_delivery index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'delivery_receipts'
     AND INDEX_NAME = 'idx_delivery_receipts_company') = 0,
    'CREATE INDEX idx_delivery_receipts_company ON delivery_receipts(company_id)',
    'SELECT "idx_delivery_receipts_company index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'delivery_occurrences'
     AND INDEX_NAME = 'idx_delivery_occurrences_delivery') = 0,
    'CREATE INDEX idx_delivery_occurrences_delivery ON delivery_occurrences(delivery_id)',
    'SELECT "idx_delivery_occurrences_delivery index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'delivery_occurrences'
     AND INDEX_NAME = 'idx_delivery_occurrences_company') = 0,
    'CREATE INDEX idx_delivery_occurrences_company ON delivery_occurrences(company_id)',
    'SELECT "idx_delivery_occurrences_company index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'delivery_occurrences'
     AND INDEX_NAME = 'idx_delivery_occurrences_type') = 0,
    'CREATE INDEX idx_delivery_occurrences_type ON delivery_occurrences(type)',
    'SELECT "idx_delivery_occurrences_type index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'tracking_points'
     AND INDEX_NAME = 'idx_tracking_points_driver') = 0,
    'CREATE INDEX idx_tracking_points_driver ON tracking_points(driver_id)',
    'SELECT "idx_tracking_points_driver index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = 'id_transportes'
     AND TABLE_NAME = 'tracking_points'
     AND INDEX_NAME = 'idx_tracking_points_company') = 0,
    'CREATE INDEX idx_tracking_points_company ON tracking_points(company_id)',
    'SELECT "idx_tracking_points_company index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Inserir dados de exemplo para teste (apenas se não existirem)
INSERT IGNORE INTO delivery_notes (company_id, nf_number, client_name, client_address, merchandise_value, status, driver_id) VALUES
(1, 'NF001', 'Cliente Teste 1', 'Rua Teste 1, 123', 150.00, 'PENDING', 2),
(1, 'NF002', 'Cliente Teste 2', 'Rua Teste 2, 456', 200.00, 'IN_TRANSIT', 2),
(1, 'NF003', 'Cliente Teste 3', 'Rua Teste 3, 789', 300.00, 'DELIVERED', 2);

-- Inserir motorista de exemplo (apenas se não existir)
INSERT IGNORE INTO drivers (company_id, user_id, license_number, vehicle_id) VALUES
(1, 2, 'LIC123456', 1);

-- Inserir veículo de exemplo (apenas se não existir)
INSERT IGNORE INTO vehicles (company_id, plate, model, year) VALUES
(1, 'ABC1234', 'Fiat Fiorino', 2020);

-- Inserir cliente de exemplo (apenas se não existirem)
INSERT IGNORE INTO clients (company_id, name, address, phone, email) VALUES
(1, 'Cliente Teste 1', 'Rua Teste 1, 123', '(11) 99999-9999', 'cliente1@teste.com'),
(1, 'Cliente Teste 2', 'Rua Teste 2, 456', '(11) 88888-8888', 'cliente2@teste.com'),
(1, 'Cliente Teste 3', 'Rua Teste 3, 789', '(11) 77777-7777', 'cliente3@teste.com');

COMMIT; 