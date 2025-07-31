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

-- Adicionar colunas necessárias à tabela drivers
ALTER TABLE drivers 
ADD COLUMN IF NOT EXISTS status ENUM('active', 'inactive', 'busy', 'available') DEFAULT 'active',
ADD COLUMN IF NOT EXISTS last_status_update TIMESTAMP NULL,
ADD COLUMN IF NOT EXISTS last_location_lat DECIMAL(10, 8),
ADD COLUMN IF NOT EXISTS last_location_lng DECIMAL(11, 8),
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP NULL;

-- Adicionar colunas necessárias à tabela delivery_notes
ALTER TABLE delivery_notes 
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_delivery ON delivery_receipts(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_receipts_company ON delivery_receipts(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_occurrences_delivery ON delivery_occurrences(delivery_id);
CREATE INDEX IF NOT EXISTS idx_delivery_occurrences_company ON delivery_occurrences(company_id);
CREATE INDEX IF NOT EXISTS idx_delivery_occurrences_type ON delivery_occurrences(type);
CREATE INDEX IF NOT EXISTS idx_tracking_points_driver ON tracking_points(driver_id);
CREATE INDEX IF NOT EXISTS idx_tracking_points_company ON tracking_points(company_id);

-- Inserir dados de exemplo para teste
INSERT INTO delivery_notes (company_id, nf_number, client_name, client_address, merchandise_value, status, driver_id) VALUES
(1, 'NF001', 'Cliente Teste 1', 'Rua Teste 1, 123', 150.00, 'PENDING', 2),
(1, 'NF002', 'Cliente Teste 2', 'Rua Teste 2, 456', 200.00, 'IN_TRANSIT', 2),
(1, 'NF003', 'Cliente Teste 3', 'Rua Teste 3, 789', 300.00, 'DELIVERED', 2);

-- Inserir motorista de exemplo
INSERT INTO drivers (company_id, user_id, license_number, vehicle_id) VALUES
(1, 2, 'LIC123456', 1);

-- Inserir veículo de exemplo
INSERT INTO vehicles (company_id, plate, model, year) VALUES
(1, 'ABC1234', 'Fiat Fiorino', 2020);

-- Inserir cliente de exemplo
INSERT INTO clients (company_id, name, address, phone, email) VALUES
(1, 'Cliente Teste 1', 'Rua Teste 1, 123', '(11) 99999-9999', 'cliente1@teste.com'),
(1, 'Cliente Teste 2', 'Rua Teste 2, 456', '(11) 88888-8888', 'cliente2@teste.com'),
(1, 'Cliente Teste 3', 'Rua Teste 3, 789', '(11) 77777-7777', 'cliente3@teste.com');

COMMIT; 