const request = require('supertest');
const app = require('../index');

describe('Drivers/Vehicles Service', () => {
  it('deve listar motoristas (mesmo que vazio)', async () => {
    const res = await request(app).get('/api/drivers');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 