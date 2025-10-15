-- Script de migração para converter banco atual para multi-tenant
-- Execute este script APÓS fazer backup do banco atual
-- Compatível com MySQL 8

USE id_transportes;

-- 1. Criar tabela de empresas se não existir
CREATE TABLE IF NOT EXISTS companies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE,
    domain VARCHAR(100) UNIQUE,
    logo_url VARCHAR(255),
    primary_color VARCHAR(7) DEFAULT '#007bff',
    secondary_color VARCHAR(7) DEFAULT '#6c757d',
    address TEXT,
    phone VARCHAR(20),
    email VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    subscription_plan ENUM('BASIC', 'PRO', 'ENTERPRISE') DEFAULT 'BASIC',
    subscription_expires_at DATE,
    max_users INT DEFAULT 10,
    max_drivers INT DEFAULT 5,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Criar tabela de configurações se não existir
CREATE TABLE IF NOT EXISTS company_settings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT UNIQUE NOT NULL,
    timezone VARCHAR(50) DEFAULT 'America/Sao_Paulo',
    working_hours_start TIME DEFAULT '08:00:00',
    working_hours_end TIME DEFAULT '18:00:00',
    delivery_timeout_hours INT DEFAULT 24,
    auto_reattempt_days INT DEFAULT 1,
    notification_email BOOLEAN DEFAULT TRUE,
    notification_sms BOOLEAN DEFAULT FALSE,
    notification_whatsapp BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id)
);

-- 3. Inserir empresa padrão
INSERT INTO companies (name, cnpj, domain, email, subscription_plan) 
VALUES ('ID Transportes', '12.345.678/0001-90', 'idtransportes', 'contato@idtransportes.com', 'ENTERPRISE')
ON DUPLICATE KEY UPDATE id = id;

-- 4. Adicionar coluna company_id à tabela users (com verificação)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'users' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE users ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in users table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Adicionar coluna last_login se não existir
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'users' 
     AND COLUMN_NAME = 'last_login') = 0,
    'ALTER TABLE users ADD COLUMN last_login DATETIME NULL',
    'SELECT "last_login column already exists in users table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 5. Adicionar foreign key para users se não existir
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'users' 
     AND CONSTRAINT_NAME = 'fk_users_company') = 0,
    'ALTER TABLE users ADD CONSTRAINT fk_users_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_users_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 6. Adicionar coluna company_id às outras tabelas
-- Drivers
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'drivers' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE drivers ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in drivers table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vehicles
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'vehicles' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE vehicles ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in vehicles table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Clients
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'clients' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE clients ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in clients table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Client Users
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'client_users' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE client_users ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in client_users table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Delivery Notes
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'delivery_notes' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE delivery_notes ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in delivery_notes table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Delivery Receipts
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'delivery_receipts' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE delivery_receipts ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in delivery_receipts table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Routes
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'routes' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE routes ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in routes table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Route Deliveries
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'route_deliveries' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE route_deliveries ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in route_deliveries table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Tracking Points
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'tracking_points' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE tracking_points ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in tracking_points table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Notifications
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'notifications' 
     AND COLUMN_NAME = 'company_id') = 0,
    'ALTER TABLE notifications ADD COLUMN company_id INT DEFAULT 1',
    'SELECT "company_id column already exists in notifications table"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 7. Adicionar foreign keys (com verificação)
-- Drivers
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'drivers' 
     AND CONSTRAINT_NAME = 'fk_drivers_company') = 0,
    'ALTER TABLE drivers ADD CONSTRAINT fk_drivers_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_drivers_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vehicles
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'vehicles' 
     AND CONSTRAINT_NAME = 'fk_vehicles_company') = 0,
    'ALTER TABLE vehicles ADD CONSTRAINT fk_vehicles_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_vehicles_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Clients
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'clients' 
     AND CONSTRAINT_NAME = 'fk_clients_company') = 0,
    'ALTER TABLE clients ADD CONSTRAINT fk_clients_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_clients_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Client Users
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'client_users' 
     AND CONSTRAINT_NAME = 'fk_client_users_company') = 0,
    'ALTER TABLE client_users ADD CONSTRAINT fk_client_users_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_client_users_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Delivery Notes
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'delivery_notes' 
     AND CONSTRAINT_NAME = 'fk_delivery_notes_company') = 0,
    'ALTER TABLE delivery_notes ADD CONSTRAINT fk_delivery_notes_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_delivery_notes_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Delivery Receipts
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'delivery_receipts' 
     AND CONSTRAINT_NAME = 'fk_delivery_receipts_company') = 0,
    'ALTER TABLE delivery_receipts ADD CONSTRAINT fk_delivery_receipts_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_delivery_receipts_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Routes
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'routes' 
     AND CONSTRAINT_NAME = 'fk_routes_company') = 0,
    'ALTER TABLE routes ADD CONSTRAINT fk_routes_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_routes_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Route Deliveries
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'route_deliveries' 
     AND CONSTRAINT_NAME = 'fk_route_deliveries_company') = 0,
    'ALTER TABLE route_deliveries ADD CONSTRAINT fk_route_deliveries_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_route_deliveries_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Tracking Points
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'tracking_points' 
     AND CONSTRAINT_NAME = 'fk_tracking_points_company') = 0,
    'ALTER TABLE tracking_points ADD CONSTRAINT fk_tracking_points_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_tracking_points_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Notifications
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'notifications' 
     AND CONSTRAINT_NAME = 'fk_notifications_company') = 0,
    'ALTER TABLE notifications ADD CONSTRAINT fk_notifications_company FOREIGN KEY (company_id) REFERENCES companies(id)',
    'SELECT "fk_notifications_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 8. Criar índices para performance (com verificação)
-- Users
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'users' 
     AND INDEX_NAME = 'idx_users_company') = 0,
    'CREATE INDEX idx_users_company ON users(company_id)',
    'SELECT "idx_users_company index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drivers
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'drivers' 
     AND INDEX_NAME = 'idx_drivers_company') = 0,
    'CREATE INDEX idx_drivers_company ON drivers(company_id)',
    'SELECT "idx_drivers_company index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vehicles
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'vehicles' 
     AND INDEX_NAME = 'idx_vehicles_company') = 0,
    'CREATE INDEX idx_vehicles_company ON vehicles(company_id)',
    'SELECT "idx_vehicles_company index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Clients
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'clients' 
     AND INDEX_NAME = 'idx_clients_company') = 0,
    'CREATE INDEX idx_clients_company ON clients(company_id)',
    'SELECT "idx_clients_company index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Delivery Notes
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'delivery_notes' 
     AND INDEX_NAME = 'idx_delivery_notes_company') = 0,
    'CREATE INDEX idx_delivery_notes_company ON delivery_notes(company_id)',
    'SELECT "idx_delivery_notes_company index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Routes
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'routes' 
     AND INDEX_NAME = 'idx_routes_company') = 0,
    'CREATE INDEX idx_routes_company ON routes(company_id)',
    'SELECT "idx_routes_company index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Tracking Points
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

-- Notifications
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.STATISTICS 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'notifications' 
     AND INDEX_NAME = 'idx_notifications_company') = 0,
    'CREATE INDEX idx_notifications_company ON notifications(company_id)',
    'SELECT "idx_notifications_company index already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 9. Criar configurações padrão para a empresa
INSERT INTO company_settings (company_id) 
SELECT 1 WHERE NOT EXISTS (SELECT 1 FROM company_settings WHERE company_id = 1);

-- 10. Alterar ENUM user_type para incluir MASTER
ALTER TABLE users MODIFY COLUMN user_type ENUM('MASTER', 'ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT') NOT NULL;

-- 11. Atualizar usuário admin existente para ser MASTER
UPDATE users SET user_type = 'MASTER' WHERE username = 'admin' AND company_id = 1;

-- 12. Verificar se existe usuário master, se não, criar
INSERT INTO users (company_id, username, password_hash, email, full_name, user_type) 
SELECT 1, 'master', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'master@idtransportes.com', 'Master Administrator', 'MASTER'
WHERE NOT EXISTS (SELECT 1 FROM users WHERE username = 'master' AND company_id = 1);

-- 13. Adicionar constraints únicas por empresa (com verificação)
-- Users
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'users' 
     AND CONSTRAINT_NAME = 'unique_username_per_company') = 0,
    'ALTER TABLE users ADD CONSTRAINT unique_username_per_company UNIQUE (company_id, username)',
    'SELECT "unique_username_per_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'users' 
     AND CONSTRAINT_NAME = 'unique_email_per_company') = 0,
    'ALTER TABLE users ADD CONSTRAINT unique_email_per_company UNIQUE (company_id, email)',
    'SELECT "unique_email_per_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drivers
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'drivers' 
     AND CONSTRAINT_NAME = 'unique_cpf_per_company') = 0,
    'ALTER TABLE drivers ADD CONSTRAINT unique_cpf_per_company UNIQUE (company_id, cpf)',
    'SELECT "unique_cpf_per_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Vehicles
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'vehicles' 
     AND CONSTRAINT_NAME = 'unique_plate_per_company') = 0,
    'ALTER TABLE vehicles ADD CONSTRAINT unique_plate_per_company UNIQUE (company_id, plate)',
    'SELECT "unique_plate_per_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Clients
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = 'id_transportes' 
     AND TABLE_NAME = 'clients' 
     AND CONSTRAINT_NAME = 'unique_cnpj_per_company') = 0,
    'ALTER TABLE clients ADD CONSTRAINT unique_cnpj_per_company UNIQUE (company_id, cnpj)',
    'SELECT "unique_cnpj_per_company constraint already exists"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Delivery Notes (allow duplicated NF numbers per empresa)
SET @sql = (SELECT IF(
    (SELECT COUNT(*) FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
     WHERE TABLE_SCHEMA = DATABASE() 
     AND TABLE_NAME = 'delivery_notes' 
     AND CONSTRAINT_NAME = 'unique_nf_per_company') > 0,
    'ALTER TABLE delivery_notes DROP INDEX unique_nf_per_company',
    'SELECT "unique_nf_per_company constraint already removed"'
));
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- 14. Tornar company_id NOT NULL após migração
-- (Execute isso apenas após verificar que todos os dados foram migrados corretamente)
-- ALTER TABLE users MODIFY COLUMN company_id INT NOT NULL;
-- ALTER TABLE drivers MODIFY COLUMN company_id INT NOT NULL;
-- ALTER TABLE vehicles MODIFY COLUMN company_id INT NOT NULL;
-- ALTER TABLE clients MODIFY COLUMN company_id INT NOT NULL;
-- ALTER TABLE delivery_notes MODIFY COLUMN company_id INT NOT NULL;

-- Verificar dados migrados
SELECT 'Verificando migração...' as status;
SELECT COUNT(*) as total_users FROM users;
SELECT COUNT(*) as total_drivers FROM drivers;
SELECT COUNT(*) as total_vehicles FROM vehicles;
SELECT COUNT(*) as total_clients FROM clients;
SELECT COUNT(*) as total_deliveries FROM delivery_notes; 
