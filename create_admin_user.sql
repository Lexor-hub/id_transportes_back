-- Script para criar usuário admin
-- Execute este script no seu banco de dados MySQL

USE id_transportes;

-- Inserir usuário admin
-- Senha: Admin123! (hash gerado com bcrypt)
INSERT INTO users (username, password_hash, email, full_name, user_type, is_active) 
VALUES (
    'admin',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', -- Senha: Admin123!
    'admin@idtransportes.com',
    'Administrador do Sistema',
    'ADMIN',
    TRUE
);

-- Verificar se foi inserido corretamente
SELECT id, username, email, full_name, user_type, is_active, created_at 
FROM users 
WHERE username = 'admin'; 