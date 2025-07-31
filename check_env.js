require('dotenv').config();

console.log('🔍 Verificando variáveis de ambiente...');
console.log('');

console.log('📋 Configurações do Banco:');
console.log('- DB_HOST:', process.env.DB_HOST || 'NÃO DEFINIDO');
console.log('- DB_USER:', process.env.DB_USER || 'NÃO DEFINIDO');
console.log('- DB_NAME:', process.env.DB_NAME || 'NÃO DEFINIDO');
console.log('- DB_PORT:', process.env.DB_PORT || 'NÃO DEFINIDO');
console.log('');

console.log('🔐 Configurações de Autenticação:');
console.log('- JWT_SECRET:', process.env.JWT_SECRET ? 'DEFINIDO' : 'NÃO DEFINIDO');
if (process.env.JWT_SECRET) {
  console.log('- JWT_SECRET (primeiros 10 chars):', process.env.JWT_SECRET.substring(0, 10) + '...');
}
console.log('');

console.log('🚀 Configurações dos Serviços:');
console.log('- AUTH_SERVICE_PORT:', process.env.AUTH_SERVICE_PORT || 'NÃO DEFINIDO');
console.log('- DELIVERIES_SERVICE_PORT:', process.env.DELIVERIES_SERVICE_PORT || 'NÃO DEFINIDO');
console.log('- DRIVERS_SERVICE_PORT:', process.env.DRIVERS_SERVICE_PORT || 'NÃO DEFINIDO');
console.log('- RECEIPTS_SERVICE_PORT:', process.env.RECEIPTS_SERVICE_PORT || 'NÃO DEFINIDO');
console.log('- TRACKING_SERVICE_PORT:', process.env.TRACKING_SERVICE_PORT || 'NÃO DEFINIDO');
console.log('- REPORTS_SERVICE_PORT:', process.env.REPORTS_SERVICE_PORT || 'NÃO DEFINIDO');
console.log('');

// Verificar se o arquivo .env existe
const fs = require('fs');
const path = require('path');
const envPath = path.join(__dirname, '.env');

if (fs.existsSync(envPath)) {
  console.log('✅ Arquivo .env encontrado');
  const envContent = fs.readFileSync(envPath, 'utf8');
  console.log('📄 Conteúdo do .env:');
  console.log(envContent);
} else {
  console.log('❌ Arquivo .env não encontrado');
} 