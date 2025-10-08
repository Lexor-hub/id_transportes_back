const fs = require('fs');
const path = require('path');

// Conteúdo correto do arquivo .env fornecido pelo usuário
const envContent = `DB_HOST=
DB_NAME=
DB_USER=
DB_PASSWORD=
DB_PORT=
JWT_SECRET=fda76ff877a92f9a86e7831fad372e2d9e777419e155aab4f5b18b37d280d05a`;

// Caminho do arquivo .env
const envPath = path.join(__dirname, '.env');

try {
  // Recriar o arquivo .env
  fs.writeFileSync(envPath, envContent);
  console.log('✅ Arquivo .env recriado com sucesso!');
  
  console.log('📋 Configurações atualizadas:');
  console.log('- DB_HOST: 207.180.252.4');
  console.log('- DB_NAME: id_transportes');
  console.log('- DB_USER: glaubermag');
  console.log('- JWT_SECRET: configurado');
  
} catch (error) {
  console.error('❌ Erro ao recriar arquivo .env:', error.message);
  process.exit(1);
} 