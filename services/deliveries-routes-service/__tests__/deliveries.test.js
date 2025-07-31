const request = require('supertest');
const app = require('../index');

describe('Deliveries/Routes Service', () => {
  it('deve listar entregas (mesmo que vazio)', async () => {
    const res = await request(app).get('/api/deliveries');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 