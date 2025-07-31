const request = require('supertest');
const app = require('../index');

describe('Reports Integration', () => {
  it('deve retornar relatório de entregas', async () => {
    const res = await request(app).get('/api/reports/deliveries');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 