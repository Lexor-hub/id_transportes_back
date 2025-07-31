const jwt = require('jsonwebtoken');

function generateValidToken() {
  const payload = {
    user_id: 11,
    username: 'supervisor',
    email: 'supervisor@idtransportes.com',
    full_name: 'Supervisor',
    user_type: 'SUPERVISOR',
    company_id: 1,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hora
  };

  const secret = 'fda76ff877a92f9a86e7831fad372e2d9e777419e155aab4f5b18b37d280d05a';
  const token = jwt.sign(payload, secret);
  
  console.log('🔑 Token gerado:');
  console.log(token);
  console.log('\n📋 Payload decodificado:');
  console.log(JSON.stringify(payload, null, 2));
  
  return token;
}

generateValidToken(); 