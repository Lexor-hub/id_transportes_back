-- Dados de Teste para ID Transportes
-- Empresa Principal
INSERT INTO companies (id, name, cnpj, domain, email, phone, address, is_active, subscription_plan, max_users, max_drivers) VALUES
(1, 'ID Transportes', '12.345.678/0001-90', 'idtransportes', 'contato@idtransportes.com', '(11) 3333-3333', 'Rua das Empresas, 123 - São Paulo/SP', TRUE, 'ENTERPRISE', 20, 10);

-- Usuários da Empresa
INSERT INTO users (company_id, username, password_hash, email, full_name, user_type, is_active) VALUES
-- MASTER (Super Admin)
(1, 'master', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'master@idtransportes.com', 'Administrador Master', 'MASTER', TRUE),
-- ADMIN
(1, 'admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@idtransportes.com', 'Administrador Geral', 'ADMIN', TRUE),
-- SUPERVISOR
(1, 'supervisor', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supervisor@idtransportes.com', 'João Supervisor', 'SUPERVISOR', TRUE),
-- OPERATOR
(1, 'operator', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'operator@idtransportes.com', 'Maria Operadora', 'OPERATOR', TRUE),
-- CLIENT
(1, 'client', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client@idtransportes.com', 'Cliente Teste', 'CLIENT', TRUE);

-- Veículos
INSERT INTO vehicles (company_id, plate, model, brand, year, color, status) VALUES
(1, 'ABC-1234', 'Fiorino', 'Fiat', 2020, 'Branco', 'active'),
(1, 'XYZ-5678', 'Kangoo', 'Renault', 2021, 'Prata', 'active'),
(1, 'DEF-9012', 'Partner', 'Peugeot', 2019, 'Azul', 'active'),
(1, 'GHI-3456', 'Doblo', 'Fiat', 2022, 'Vermelho', 'maintenance');

-- Motoristas
INSERT INTO drivers (company_id, name, cpf, cnh, phone, email, status, vehicle_id) VALUES
(1, 'João Motorista', '123.456.789-00', '12345678900', '(11) 99999-9999', 'joao@idtransportes.com', 'active', 1),
(1, 'Maria Condutora', '987.654.321-00', '98765432100', '(11) 88888-8888', 'maria@idtransportes.com', 'active', 2),
(1, 'Pedro Entregador', '456.789.123-00', '45678912300', '(11) 77777-7777', 'pedro@idtransportes.com', 'active', 3),
(1, 'Ana Transportadora', '789.123.456-00', '78912345600', '(11) 66666-6666', 'ana@idtransportes.com', 'inactive', NULL);

-- Entregas
INSERT INTO deliveries (company_id, nf_number, client_name, client_address, client_phone, merchandise_value, status, driver_id, notes) VALUES
(1, 'NF001', 'Cliente A', 'Rua das Flores, 123 - São Paulo/SP', '(11) 11111-1111', 150.00, 'DELIVERED', 1, 'Entrega realizada com sucesso'),
(1, 'NF002', 'Cliente B', 'Av. Paulista, 456 - São Paulo/SP', '(11) 22222-2222', 250.00, 'IN_TRANSIT', 2, 'Em trânsito'),
(1, 'NF003', 'Cliente C', 'Rua Augusta, 789 - São Paulo/SP', '(11) 33333-3333', 300.00, 'PENDING', NULL, 'Aguardando atribuição'),
(1, 'NF004', 'Cliente D', 'Rua Oscar Freire, 321 - São Paulo/SP', '(11) 44444-4444', 180.00, 'REFUSED', 3, 'Cliente recusou a entrega'),
(1, 'NF005', 'Cliente E', 'Av. Brigadeiro Faria Lima, 654 - São Paulo/SP', '(11) 55555-5555', 400.00, 'CANCELLED', NULL, 'Entrega cancelada'),
(1, 'NF006', 'Cliente F', 'Rua 25 de Março, 987 - São Paulo/SP', '(11) 66666-6666', 120.00, 'PENDING', NULL, 'Nova entrega'),
(1, 'NF007', 'Cliente G', 'Av. São João, 147 - São Paulo/SP', '(11) 77777-7777', 280.00, 'IN_TRANSIT', 1, 'Em rota'),
(1, 'NF008', 'Cliente H', 'Rua 7 de Abril, 258 - São Paulo/SP', '(11) 88888-8888', 350.00, 'PENDING', NULL, 'Aguardando motorista');

-- Ocorrências
INSERT INTO delivery_occurrences (delivery_id, type, description, latitude, longitude) VALUES
(1, 'reentrega', 'Cliente não estava em casa na primeira tentativa', -23.5505, -46.6333),
(4, 'recusa', 'Cliente recusou a entrega - produto não era o esperado', -23.5505, -46.6333),
(2, 'outro', 'Trânsito intenso na região', -23.5505, -46.6333);

-- Localizações dos Motoristas (últimas posições)
INSERT INTO driver_locations (driver_id, latitude, longitude, accuracy, speed, heading, delivery_id, timestamp) VALUES
(1, -23.5505, -46.6333, 10, 45.5, 90, 7, NOW()),
(2, -23.5505, -46.6333, 15, 35.2, 180, 2, NOW()),
(3, -23.5505, -46.6333, 8, 0.0, 0, NULL, NOW());

-- Canhotos/Comprovantes
INSERT INTO receipts (company_id, delivery_id, driver_id, filename, file_path, file_size, mime_type, status, validated) VALUES
(1, 1, 1, 'canhoto-nf001.jpg', '/uploads/receipts/canhoto-nf001.jpg', 1024000, 'image/jpeg', 'VALIDATED', TRUE),
(1, 2, 2, 'canhoto-nf002.jpg', '/uploads/receipts/canhoto-nf002.jpg', 2048000, 'image/jpeg', 'PROCESSED', FALSE),
(1, 4, 3, 'canhoto-nf004.jpg', '/uploads/receipts/canhoto-nf004.jpg', 1536000, 'image/jpeg', 'PENDING', FALSE);

-- Empresa de Teste 2
INSERT INTO companies (id, name, cnpj, domain, email, phone, address, is_active, subscription_plan, max_users, max_drivers) VALUES
(2, 'Transportes Rápidos', '98.765.432/0001-10', 'transportesrapidos', 'contato@transportesrapidos.com', '(11) 4444-4444', 'Av. Industrial, 456 - São Paulo/SP', TRUE, 'PRO', 10, 5);

-- Usuários da Empresa 2
INSERT INTO users (company_id, username, password_hash, email, full_name, user_type, is_active) VALUES
(2, 'admin2', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@transportesrapidos.com', 'Admin Transportes Rápidos', 'ADMIN', TRUE),
(2, 'driver2', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'driver@transportesrapidos.com', 'Carlos Motorista', 'DRIVER', TRUE);

-- Veículos da Empresa 2
INSERT INTO vehicles (company_id, plate, model, brand, year, color, status) VALUES
(2, 'RAP-1234', 'Sprinter', 'Mercedes', 2021, 'Branco', 'active');

-- Motorista da Empresa 2
INSERT INTO drivers (company_id, name, cpf, cnh, phone, email, status, vehicle_id) VALUES
(2, 'Carlos Motorista', '111.222.333-44', '11122233344', '(11) 55555-5555', 'carlos@transportesrapidos.com', 'active', 5);

-- Entregas da Empresa 2
INSERT INTO deliveries (company_id, nf_number, client_name, client_address, client_phone, merchandise_value, status, driver_id) VALUES
(2, 'NF-RAP001', 'Cliente Rápido A', 'Rua Comercial, 123 - São Paulo/SP', '(11) 99999-9999', 200.00, 'DELIVERED', 5); 