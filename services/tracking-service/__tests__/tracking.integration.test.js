const request = require('supertest');
const app = require('../index');

describe('Tracking Integration', () => {
  it('deve retornar histórico de rota de motorista', async () => {
    const res = await request(app).get('/api/tracking/drivers/1/history');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 