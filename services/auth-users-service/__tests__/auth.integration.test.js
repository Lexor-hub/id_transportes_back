const request = require('supertest');
const app = require('../index');

describe('Auth/Users Integration', () => {
  it('deve retornar 401 ao tentar login com usuário inexistente', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'usuario_inexistente', password: 'senhaerrada' });
    expect(res.statusCode).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
}); 