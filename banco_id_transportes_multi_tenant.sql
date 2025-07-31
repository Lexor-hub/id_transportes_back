-- Script de criação do banco de dados id_transportes com suporte multi-tenant
CREATE DATABASE IF NOT EXISTS id_transportes DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE id_transportes;

-- 1. Tabela de Empresas (Tenants)
CREATE TABLE companies (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18) UNIQUE,
    domain VARCHAR(100) UNIQUE, -- subdomain ou domínio personalizado
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

-- 2. Tabela de Usuários (agora com company_id)
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    username VARCHAR(100) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    full_name VARCHAR(255),
    user_type ENUM('MASTER', 'ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    last_login DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    UNIQUE KEY unique_username_per_company (company_id, username),
    UNIQUE KEY unique_email_per_company (company_id, email)
);

-- 3. Tabela de Motoristas (agora com company_id)
CREATE TABLE drivers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    user_id INT UNIQUE NOT NULL,
    cpf VARCHAR(14) NOT NULL,
    phone_number VARCHAR(20),
    tech_knowledge ENUM('LOW', 'MEDIUM', 'HIGH'),
    is_outsourced BOOLEAN DEFAULT TRUE,
    license_number VARCHAR(20),
    license_expiry DATE,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE KEY unique_cpf_per_company (company_id, cpf)
);

-- 4. Tabela de Veículos (agora com company_id)
CREATE TABLE vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    plate VARCHAR(10) NOT NULL,
    model VARCHAR(100),
    year INT,
    brand VARCHAR(100),
    color VARCHAR(50),
    capacity DECIMAL(10,2),
    fuel_type ENUM('GASOLINE', 'ETHANOL', 'DIESEL', 'ELECTRIC', 'HYBRID'),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    UNIQUE KEY unique_plate_per_company (company_id, plate)
);

-- 5. Tabela de Clientes (agora com company_id)
CREATE TABLE clients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    cnpj VARCHAR(18),
    address VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(2),
    zip_code VARCHAR(10),
    phone VARCHAR(20),
    email VARCHAR(100),
    contact_person VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    UNIQUE KEY unique_cnpj_per_company (company_id, cnpj)
);

-- 6. Tabela de Usuários de Cliente (agora com company_id)
CREATE TABLE client_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    user_id INT UNIQUE NOT NULL,
    client_id INT NOT NULL,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- 7. Tabela de Notas de Entrega (agora com company_id)
CREATE TABLE delivery_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    nf_number VARCHAR(50) NOT NULL,
    client_id INT,
    client_name_extracted VARCHAR(255),
    delivery_address VARCHAR(255) NOT NULL,
    delivery_volume DECIMAL(10,2),
    merchandise_value DECIMAL(10,2),
    products_description TEXT,
    xml_data TEXT,
    status ENUM('PENDING', 'IN_TRANSIT', 'DELIVERED', 'REFUSED', 'REATTEMPTED', 'PROBLEM', 'CANCELED') NOT NULL,
    delivery_date_expected DATE,
    delivery_date_actual DATE,
    delivery_time_actual TIME,
    receiver_name VARCHAR(255),
    receiver_document VARCHAR(20),
    observations TEXT,
    is_reattempt BOOLEAN DEFAULT FALSE,
    refusal_reason TEXT,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (client_id) REFERENCES clients(id),
    UNIQUE KEY unique_nf_per_company (company_id, nf_number)
);

-- 8. Tabela de Canhotos de Entrega (agora com company_id)
CREATE TABLE delivery_receipts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    delivery_note_id INT UNIQUE NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    photo_datetime DATETIME,
    captured_by_user_id INT,
    signature_image_url VARCHAR(255),
    ocr_extracted_data JSON,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id),
    FOREIGN KEY (captured_by_user_id) REFERENCES users(id)
);

-- 9. Tabela de Rotas (agora com company_id)
CREATE TABLE routes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    driver_id INT NOT NULL,
    vehicle_id INT,
    start_datetime DATETIME,
    end_datetime DATETIME,
    status ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED') NOT NULL,
    total_distance DECIMAL(10,2),
    total_deliveries INT DEFAULT 0,
    completed_deliveries INT DEFAULT 0,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (driver_id) REFERENCES drivers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- 10. Tabela de Entregas por Rota (agora com company_id)
CREATE TABLE route_deliveries (
    company_id INT NOT NULL,
    route_id INT NOT NULL,
    delivery_note_id INT NOT NULL,
    sequence_in_route INT,
    created_at DATETIME,
    PRIMARY KEY (route_id, delivery_note_id),
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (route_id) REFERENCES routes(id),
    FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id)
);

-- 11. Tabela de Pontos de Rastreamento (agora com company_id)
CREATE TABLE tracking_points (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    route_id INT NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    timestamp DATETIME NOT NULL,
    speed_kmh DECIMAL(5,2),
    event_type ENUM('LOCATION_UPDATE', 'STOP', 'ARRIVAL_CLIENT', 'DELIVERY_DONE', 'PROBLEM', 'ROUTE_STARTED', 'ROUTE_FINISHED', 'DRIVER_LOGIN'),
    associated_delivery_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (route_id) REFERENCES routes(id),
    FOREIGN KEY (associated_delivery_id) REFERENCES delivery_notes(id)
);

-- 12. Tabela de Notificações (agora com company_id)
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    user_id INT NOT NULL,
    type VARCHAR(100) NOT NULL,
    message TEXT NOT NULL,
    status ENUM('PENDING', 'SENT', 'READ', 'FAILED') NOT NULL,
    sent_via ENUM('WHATSAPP', 'EMAIL', 'APP_PUSH', 'SMS') NOT NULL,
    related_entity_type VARCHAR(50),
    related_entity_id INT,
    created_at DATETIME,
    sent_at DATETIME,
    read_at DATETIME,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 13. Tabela de Configurações por Empresa
CREATE TABLE company_settings (
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

-- 14. Tabela de Logs de Atividade
CREATE TABLE activity_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    company_id INT NOT NULL,
    user_id INT,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id INT,
    details JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (company_id) REFERENCES companies(id),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Índices para melhor performance
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_drivers_company ON drivers(company_id);
CREATE INDEX idx_vehicles_company ON vehicles(company_id);
CREATE INDEX idx_clients_company ON clients(company_id);
CREATE INDEX idx_delivery_notes_company ON delivery_notes(company_id);
CREATE INDEX idx_routes_company ON routes(company_id);
CREATE INDEX idx_tracking_points_company ON tracking_points(company_id);
CREATE INDEX idx_notifications_company ON notifications(company_id);

-- Inserir empresa padrão para testes
INSERT INTO companies (name, cnpj, domain, email, subscription_plan) 
VALUES ('ID Transportes', '12.345.678/0001-90', 'idtransportes', 'contato@idtransportes.com', 'ENTERPRISE');

-- Inserir usuário master para gerenciar o sistema
INSERT INTO users (company_id, username, password_hash, email, full_name, user_type) 
VALUES (1, 'master', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'master@idtransportes.com', 'Master Administrator', 'MASTER'); 