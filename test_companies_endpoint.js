const fetch = require('node-fetch');

async function testCompaniesEndpoint() {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MiwidXNlcl90eXBlIjoiTUFTVEVSIiwiY29tcGFueV9pZCI6MSwiaWF0IjoxNzUzOTYwMjExLCJleHAiOjE3NTQwNDY2MTF9.SXYmuwX5I07RCm7XBxDPtWgPooiY1ik6D7raIU6a9vw';
  
  try {
    console.log('🔍 Testando endpoint na porta 3000...');
    const response = await fetch('http://localhost:3000/api/auth/companies', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Resposta:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Erro ao testar porta 3000:', error.message);
  }
  
  try {
    console.log('\n🔍 Testando endpoint na porta 3001...');
    const response = await fetch('http://localhost:3001/api/auth/companies', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    console.log('Status:', response.status);
    const data = await response.json();
    console.log('Resposta:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Erro ao testar porta 3001:', error.message);
  }
}

testCompaniesEndpoint(); 