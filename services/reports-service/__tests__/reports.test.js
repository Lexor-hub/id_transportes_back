const request = require('supertest');
const app = require('../index');

describe('Reports Service', () => {
  it('deve retornar um array para relatório de entregas', async () => {
    const res = await request(app).get('/api/reports/deliveries');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 