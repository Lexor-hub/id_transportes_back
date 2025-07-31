const https = require('https');
const http = require('http');

async function testTrackingEndpoint() {
  try {
    console.log('🧪 Testando endpoint de tracking...');
    
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoxLCJ1c2VybmFtZSI6Im1hc3RlciIsImVtYWlsIjoibWFzdGVyQGlkdHJhbnNwb3J0ZXMuY29tIiwiZnVsbF9uYW1lIjoiTWFzdGVyIEFkbWluaXN0cmF0b3IiLCJ1c2VyX3R5cGUiOiJNQVNURVIiLCJjb21wYW55X2lkIjoxLCJpYXQiOjE3NTM5MzUzMDYsImV4cCI6MTc1MzkzODkwNn0.PuJ55tozrAZkKWT5fnhCvQ-RoR3lkDM_Sdx15oFKh3I';
    
    const options = {
      hostname: 'localhost',
      port: 3005,
      path: '/api/tracking/drivers/current-locations',
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      timeout: 5000
    };

    console.log('📡 Fazendo requisição para:', `http://${options.hostname}:${options.port}${options.path}`);

    const req = http.request(options, (res) => {
      console.log(`📡 Status: ${res.statusCode}`);
      console.log(`📡 Headers:`, res.headers);
      
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        console.log('📡 Resposta:');
        try {
          const jsonData = JSON.parse(data);
          console.log(JSON.stringify(jsonData, null, 2));
        } catch (e) {
          console.log('Resposta não é JSON:', data);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição:', error);
    });

    req.on('timeout', () => {
      console.error('⏰ Timeout na requisição');
      req.destroy();
    });

    req.end();
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testTrackingEndpoint(); 