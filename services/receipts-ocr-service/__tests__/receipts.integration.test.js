const request = require('supertest');
const app = require('../index');

describe('Receipts/OCR Integration', () => {
  it('deve listar canhotos', async () => {
    const res = await request(app).get('/api/receipts');
    expect(res.statusCode).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
}); 