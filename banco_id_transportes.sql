-- Script de criação do banco de dados id_transportes
CREATE DATABASE IF NOT EXISTS id_transportes DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE id_transportes;

-- 1. Tabela de Usuários
CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100) UNIQUE,
    full_name VARCHAR(255),
    user_type ENUM('ADMIN', 'SUPERVISOR', 'OPERATOR', 'DRIVER', 'CLIENT') NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Tabela de Motoristas
CREATE TABLE drivers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    cpf VARCHAR(14) UNIQUE NOT NULL,
    phone_number VARCHAR(20),
    tech_knowledge ENUM('LOW', 'MEDIUM', 'HIGH'),
    is_outsourced BOOLEAN DEFAULT TRUE,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- 3. Tabela de Veículos
CREATE TABLE vehicles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    plate VARCHAR(10) UNIQUE NOT NULL,
    model VARCHAR(100),
    year INT,
    created_at DATETIME,
    updated_at DATETIME
);

-- 4. Tabela de Clientes
CREATE TABLE clients (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(255) UNIQUE NOT NULL,
    cnpj VARCHAR(18) UNIQUE,
    address VARCHAR(255),
    created_at DATETIME,
    updated_at DATETIME
);

-- 5. Tabela de Usuários de Cliente
CREATE TABLE client_users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    user_id INT UNIQUE NOT NULL,
    client_id INT NOT NULL,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- 6. Tabela de Notas de Entrega
CREATE TABLE delivery_notes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nf_number VARCHAR(50) UNIQUE NOT NULL,
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
    FOREIGN KEY (client_id) REFERENCES clients(id)
);

-- 7. Tabela de Canhotos de Entrega
CREATE TABLE delivery_receipts (
    id INT PRIMARY KEY AUTO_INCREMENT,
    delivery_note_id INT UNIQUE NOT NULL,
    image_url VARCHAR(255) NOT NULL,
    photo_datetime DATETIME,
    captured_by_user_id INT,
    signature_image_url VARCHAR(255),
    ocr_extracted_data JSON,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id),
    FOREIGN KEY (captured_by_user_id) REFERENCES users(id)
);

-- 8. Tabela de Rotas
CREATE TABLE routes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    driver_id INT NOT NULL,
    vehicle_id INT,
    start_datetime DATETIME,
    end_datetime DATETIME,
    status ENUM('PLANNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELED') NOT NULL,
    created_at DATETIME,
    updated_at DATETIME,
    FOREIGN KEY (driver_id) REFERENCES drivers(id),
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id)
);

-- 9. Tabela de Entregas por Rota
CREATE TABLE route_deliveries (
    route_id INT NOT NULL,
    delivery_note_id INT NOT NULL,
    sequence_in_route INT,
    created_at DATETIME,
    PRIMARY KEY (route_id, delivery_note_id),
    FOREIGN KEY (route_id) REFERENCES routes(id),
    FOREIGN KEY (delivery_note_id) REFERENCES delivery_notes(id)
);

-- 10. Tabela de Pontos de Rastreamento
CREATE TABLE tracking_points (
    id INT PRIMARY KEY AUTO_INCREMENT,
    route_id INT NOT NULL,
    latitude DECIMAL(10,8) NOT NULL,
    longitude DECIMAL(11,8) NOT NULL,
    timestamp DATETIME NOT NULL,
    speed_kmh DECIMAL(5,2),
    event_type ENUM('LOCATION_UPDATE', 'STOP', 'ARRIVAL_CLIENT', 'DELIVERY_DONE', 'PROBLEM', 'ROUTE_STARTED', 'ROUTE_FINISHED', 'DRIVER_LOGIN'),
    associated_delivery_id INT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (route_id) REFERENCES routes(id),
    FOREIGN KEY (associated_delivery_id) REFERENCES delivery_notes(id)
);

-- 11. Tabela de Notificações
CREATE TABLE notifications (
    id INT PRIMARY KEY AUTO_INCREMENT,
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
    FOREIGN KEY (user_id) REFERENCES users(id)
); 