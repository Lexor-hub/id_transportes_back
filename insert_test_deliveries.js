const pool = require('./shared/db');

async function insertTestDeliveries() {
  try {
    console.log('📦 Inserindo entregas de teste...');
    
    // Verificar se já existem dados
    const [existingData] = await pool.query('SELECT COUNT(*) as total FROM delivery_notes');
    if (existingData[0].total > 0) {
      console.log('✅ Já existem dados na tabela delivery_notes');
      return;
    }
    
    // Inserir entregas de teste
    const testDeliveries = [
      {
        company_id: 1,
        nf_number: 'NF001',
        client_name_extracted: 'Cliente Teste 1',
        delivery_address: 'Rua Teste 1, 123 - São Paulo/SP',
        merchandise_value: 150.00,
        status: 'PENDING',
        driver_id: 16, // joao_motorista
        created_at: new Date()
      },
      {
        company_id: 1,
        nf_number: 'NF002',
        client_name_extracted: 'Cliente Teste 2',
        delivery_address: 'Rua Teste 2, 456 - São Paulo/SP',
        merchandise_value: 200.00,
        status: 'IN_TRANSIT',
        driver_id: 16, // joao_motorista
        created_at: new Date()
      },
      {
        company_id: 1,
        nf_number: 'NF003',
        client_name_extracted: 'Cliente Teste 3',
        delivery_address: 'Rua Teste 3, 789 - São Paulo/SP',
        merchandise_value: 300.00,
        status: 'DELIVERED',
        driver_id: 16, // joao_motorista
        created_at: new Date()
      },
      {
        company_id: 1,
        nf_number: 'NF004',
        client_name_extracted: 'Cliente Teste 4',
        delivery_address: 'Rua Teste 4, 321 - São Paulo/SP',
        merchandise_value: 180.00,
        status: 'PENDING',
        driver_id: 17, // maria_motorista
        created_at: new Date()
      },
      {
        company_id: 1,
        nf_number: 'NF005',
        client_name_extracted: 'Cliente Teste 5',
        delivery_address: 'Rua Teste 5, 654 - São Paulo/SP',
        merchandise_value: 250.00,
        status: 'IN_TRANSIT',
        driver_id: 17, // maria_motorista
        created_at: new Date()
      }
    ];
    
    for (const delivery of testDeliveries) {
      await pool.query(`
        INSERT INTO delivery_notes (
          company_id, nf_number, client_name_extracted, delivery_address,
          merchandise_value, status, driver_id, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        delivery.company_id,
        delivery.nf_number,
        delivery.client_name_extracted,
        delivery.delivery_address,
        delivery.merchandise_value,
        delivery.status,
        delivery.driver_id,
        delivery.created_at
      ]);
    }
    
    console.log('✅ 5 entregas de teste inseridas com sucesso');
    
    // Verificar os dados inseridos
    const [insertedData] = await pool.query(`
      SELECT d.*, u.username as driver_username
      FROM delivery_notes d
      LEFT JOIN users u ON d.driver_id = u.id
      ORDER BY d.created_at DESC
    `);
    
    console.log('📋 Dados inseridos:');
    insertedData.forEach((delivery, index) => {
      console.log(`  ${index + 1}. NF: ${delivery.nf_number} | Cliente: ${delivery.client_name_extracted} | Motorista: ${delivery.driver_username} | Status: ${delivery.status}`);
    });
    
  } catch (error) {
    console.error('❌ Erro ao inserir entregas de teste:', error);
  } finally {
    await pool.end();
  }
}

insertTestDeliveries(); 