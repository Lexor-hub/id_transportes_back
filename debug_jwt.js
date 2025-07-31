const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('🔍 Debugando JWT...');
console.log('JWT_SECRET:', process.env.JWT_SECRET);

// Token que está falhando
const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcl90eXBlIjoiTUFTVEVSIiwiY29tcGFueV9pZCI6MSwiaWF0IjoxNzUzOTI3Njk5LCJleHAiOjE3NTQwMTQwOTl9.8eST0Onitq3_CAxuIg__l2jehNiMbdYeYqIwUrvW3u8';

try {
  const decoded = jwt.verify(token, "fda76ff877a92f9a86e7831fad372e2d9e777419e155aab4f5b18b37d280d05a");
  console.log('✅ Token válido:', decoded);
} catch (error) {
  console.error('❌ Erro ao verificar token:', error.message);
}

// Vamos gerar um novo token para teste
const testPayload = {
  id: 2,
  user_type: 'MASTER',
  company_id: 1
};

const newToken = jwt.sign(testPayload, process.env.JWT_SECRET, { expiresIn: '1d' });
console.log('🆕 Novo token gerado:', newToken);

try {
  const decodedNew = jwt.verify(newToken, process.env.JWT_SECRET);
  console.log('✅ Novo token válido:', decodedNew);
} catch (error) {
  console.error('❌ Erro ao verificar novo token:', error.message);
} 