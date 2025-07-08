import request from 'supertest';
import app from '../../../server';

describe('POST /api/auth/register', () => {
  it('should return 400 for missing required fields', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@example.com', password: 'password123' }); // missing fullName and companyName
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should register a new user and organization', async () => {
    const uniqueEmail = `user${Date.now()}@example.com`;
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        fullName: 'Test User',
        email: uniqueEmail,
        password: 'password123',
        companyName: 'Test Company'
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('user');
    expect(res.body).toHaveProperty('organization');
    expect(res.body).toHaveProperty('token');
  });
}); 