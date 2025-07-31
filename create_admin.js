const bcrypt = require('bcrypt');
const pool = require('./shared/db');

async function createAdminUser() {
  try {
    // Verificar se o usuário admin já existe
    const [existingUsers] = await pool.query('SELECT id FROM users WHERE username = ?', ['admin']);
    
    if (existingUsers.length > 0) {
      console.log('🗑️ Removendo usuário admin existente...');
      await pool.query('DELETE FROM users WHERE username = ?', ['admin']);
    }

    // Criar hash da senha
    const password = 'admin123';
    const hash = await bcrypt.hash(password, 10);

    console.log('🔑 Senha original:', password);
    console.log('🔐 Hash gerado:', hash);

    // Inserir usuário admin
    await pool.query(
      'INSERT INTO users (username, password_hash, email, full_name, user_type, is_active) VALUES (?, ?, ?, ?, ?, ?)',
      ['admin', hash, 'admin@idtransportes.com', 'Administrador do Sistema', 'ADMIN', true]
    );

    console.log('✅ Usuário admin criado com sucesso!');
    console.log('📧 Username: admin');
    console.log('🔑 Senha: admin123');
    console.log('👤 Tipo: ADMIN');
    
  } catch (error) {
    console.error('❌ Erro ao criar usuário admin:', error.message);
  } finally {
    await pool.end();
  }
}

// Executar o script
createAdminUser(); 