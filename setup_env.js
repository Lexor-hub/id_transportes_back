const fs = require('fs');
const path = require('path');

// Conteúdo do arquivo .env
const envContent = `# Configurações do Banco de Dados
DB_HOST=${{ MYSQLHOST }}
DB_USER=${{ MYSQLUSER }}
DB_PASSWORD=${{ MYSQLPASSWORD }}
DB_NAME=${{ MYSQLDATABASE }}
DB_PORT=${{ MYSQLPORT }}

# JWT Secret para autenticação
JWT_SECRET=id_transportes_secret_key_2024

# Configurações dos Serviços
AUTH_SERVICE_PORT=3001
DELIVERIES_SERVICE_PORT=3002
DRIVERS_SERVICE_PORT=3003
RECEIPTS_SERVICE_PORT=3004
TRACKING_SERVICE_PORT=3005
REPORTS_SERVICE_PORT=3006
`;

// Caminho do arquivo .env
const envPath = path.join(__dirname, '.env');

try {
  // Verificar se o arquivo já existe
  if (fs.existsSync(envPath)) {
    console.log('✅ Arquivo .env já existe');
  } else {
    // Criar o arquivo .env
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Arquivo .env criado com sucesso!');
  }
  
  console.log('📋 Configurações do ambiente:');
  console.log('- JWT_SECRET configurado');
  console.log('- Portas dos serviços configuradas');
  console.log('- Configurações do banco de dados definidas');
  
} catch (error) {
  console.error('❌ Erro ao criar arquivo .env:', error.message);
  process.exit(1);
} 