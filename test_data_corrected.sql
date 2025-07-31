-- Dados de Teste Corrigidos para ID Transportes
-- Baseado na estrutura real do banco

-- Limpar dados existentes (opcional)
-- DELETE FROM users WHERE username IN ('master', 'admin', 'supervisor', 'operator', 'client', 'admin2', 'driver2');
-- DELETE FROM companies WHERE domain IN ('idtransportes', 'transportesrapidos');

-- Empresa Principal (se não existir)
INSERT IGNORE INTO companies (id, name, cnpj, domain, email, phone, address, is_active, subscription_plan, max_users, max_drivers) VALUES
(1, 'ID Transportes', '12.345.678/0001-90', 'idtransportes', 'contato@idtransportes.com', '(11) 3333-3333', 'Rua das Empresas, 123 - São Paulo/SP', 1, 'ENTERPRISE', 20, 10);

-- Usuários da Empresa (corrigidos para estrutura real)
INSERT IGNORE INTO users (company_id, username, password_hash, email, full_name, user_type, is_active) VALUES
-- MASTER (Super Admin)
(1, 'master', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'master@idtransportes.com', 'Administrador Master', 'MASTER', 1),
-- ADMIN
(1, 'admin', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@idtransportes.com', 'Administrador Geral', 'ADMIN', 1),
-- SUPERVISOR
(1, 'supervisor', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'supervisor@idtransportes.com', 'João Supervisor', 'SUPERVISOR', 1),
-- OPERATOR
(1, 'operator', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'operator@idtransportes.com', 'Maria Operadora', 'OPERATOR', 1),
-- CLIENT
(1, 'client', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'client@idtransportes.com', 'Cliente Teste', 'CLIENT', 1);

-- Veículos (corrigidos para estrutura real)
INSERT IGNORE INTO vehicles (company_id, plate, model, year) VALUES
(1, 'ABC-1234', 'Fiat Fiorino', 2020),
(1, 'XYZ-5678', 'Renault Kangoo', 2021),
(1, 'DEF-9012', 'Peugeot Partner', 2019),
(1, 'GHI-3456', 'Fiat Doblo', 2022);

-- Motoristas (corrigidos para estrutura real)
-- Primeiro criar usuários motoristas
INSERT IGNORE INTO users (company_id, username, password_hash, email, full_name, user_type, is_active) VALUES
(1, 'joao_motorista', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'joao@idtransportes.com', 'João Motorista', 'DRIVER', 1),
(1, 'maria_motorista', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'maria@idtransportes.com', 'Maria Condutora', 'DRIVER', 1),
(1, 'pedro_motorista', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'pedro@idtransportes.com', 'Pedro Entregador', 'DRIVER', 1);

-- Depois criar registros de motoristas
INSERT IGNORE INTO drivers (user_id, company_id, cpf, phone_number, status) VALUES
((SELECT id FROM users WHERE username = 'joao_motorista'), 1, '123.456.789-00', '(11) 99999-9999', 'active'),
((SELECT id FROM users WHERE username = 'maria_motorista'), 1, '987.654.321-00', '(11) 88888-8888', 'active'),
((SELECT id FROM users WHERE username = 'pedro_motorista'), 1, '456.789.123-00', '(11) 77777-7777', 'active');

-- Empresa de Teste 2
INSERT IGNORE INTO companies (id, name, cnpj, domain, email, phone, address, is_active, subscription_plan, max_users, max_drivers) VALUES
(2, 'Transportes Rápidos', '98.765.432/0001-10', 'transportesrapidos', 'contato@transportesrapidos.com', '(11) 4444-4444', 'Av. Industrial, 456 - São Paulo/SP', 1, 'PRO', 10, 5);

-- Usuários da Empresa 2
INSERT IGNORE INTO users (company_id, username, password_hash, email, full_name, user_type, is_active) VALUES
(2, 'admin2', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin@transportesrapidos.com', 'Admin Transportes Rápidos', 'ADMIN', 1),
(2, 'driver2', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'driver@transportesrapidos.com', 'Carlos Motorista', 'DRIVER', 1);

-- Veículos da Empresa 2
INSERT IGNORE INTO vehicles (company_id, plate, model, year) VALUES
(2, 'RAP-1234', 'Mercedes Sprinter', 2021);

-- Motorista da Empresa 2
INSERT IGNORE INTO drivers (user_id, company_id, cpf, phone_number, status) VALUES
((SELECT id FROM users WHERE username = 'driver2'), 2, '111.222.333-44', '(11) 55555-5555', 'active'); 