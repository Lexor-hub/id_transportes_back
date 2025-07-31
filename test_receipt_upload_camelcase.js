const fs = require('fs');
const FormData = require('form-data');
const http = require('http');

async function testReceiptUploadCamelCase() {
  try {
    console.log('🧪 Testando upload de canhoto com camelCase...');
    
    // Criar um arquivo de teste
    const testFilePath = './test_image_camelcase.jpg';
    fs.writeFileSync(testFilePath, 'fake image data');
    
    const form = new FormData();
    form.append('file', fs.createReadStream(testFilePath));
    form.append('deliveryId', '2');  // camelCase
    form.append('driverId', '16');   // camelCase
    form.append('notes', 'Teste de upload com camelCase');
    
    const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MTYsInVzZXJfdHlwZSI6IkRSSVZFUiIsImNvbXBhbnlfaWQiOjEsImlhdCI6MTc1MzkzMzc3MiwiZXhwIjoxNzU0MDIwMTcyfQ.IHnMxd2GjSDfvEMzwvC7otkkGH31JM4F6HziOH1n9JI';
    
    const options = {
      hostname: 'localhost',
      port: 3004,
      path: '/api/receipts/upload',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        ...form.getHeaders()
      }
    };

    console.log('📡 Fazendo requisição para:', `http://${options.hostname}:${options.port}${options.path}`);
    console.log('📋 Dados enviados (camelCase):');
    console.log('   - deliveryId: 2');
    console.log('   - driverId: 16');
    console.log('   - notes: Teste de upload com camelCase');

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
        
        // Limpar arquivo de teste
        if (fs.existsSync(testFilePath)) {
          fs.unlinkSync(testFilePath);
        }
      });
    });

    req.on('error', (error) => {
      console.error('❌ Erro na requisição:', error);
    });

    form.pipe(req);
    
  } catch (error) {
    console.error('❌ Erro:', error);
  }
}

testReceiptUploadCamelCase(); 