const jwt = require('jsonwebtoken');
require('dotenv').config();

console.log('🔍 Testando JWT diretamente...');
console.log('JWT_SECRET:', process.env.JWT_SECRET ? 'DEFINIDO' : 'NÃO DEFINIDO');

if (process.env.JWT_SECRET) {
  try {
    const token = jwt.sign({ 
      id: 1, 
      user_type: 'ADMIN', 
      company_id: 1 
    }, process.env.JWT_SECRET, { expiresIn: '1d' });
    
    console.log('✅ Token gerado com sucesso!');
    console.log('Token:', token.substring(0, 50) + '...');
    
    // Verificar o token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('✅ Token verificado com sucesso!');
    console.log('Payload:', decoded);
    
  } catch (error) {
    console.error('❌ Erro ao gerar/verificar token:', error.message);
  }
} else {
  console.error('❌ JWT_SECRET não está definido');
} 