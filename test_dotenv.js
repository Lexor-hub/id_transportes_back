const path = require('path');
const fs = require('fs');

console.log('🔍 Testando dotenv...');
console.log('📁 Diretório atual:', process.cwd());
console.log('📄 Arquivo .env existe:', fs.existsSync('.env'));

// Tentar carregar dotenv manualmente
require('dotenv').config();

console.log('🔑 JWT_SECRET:', process.env.JWT_SECRET);
console.log('🏠 DB_HOST:', process.env.DB_HOST);
console.log('👤 DB_USER:', process.env.DB_USER);
console.log('🗄️ DB_NAME:', process.env.DB_NAME);

// Tentar carregar com path explícito
require('dotenv').config({ path: path.resolve('.env') });

console.log('🔑 JWT_SECRET (com path):', process.env.JWT_SECRET); 