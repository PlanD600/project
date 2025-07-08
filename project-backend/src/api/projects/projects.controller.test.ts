import request from 'supertest';
import app from '../../../server';

describe('POST /api/projects', () => {
  it('should return 400 for missing required fields', async () => {
    // Simulate an authenticated user (mock or use a test token if needed)
    const res = await request(app)
      .post('/api/projects')
      .send({ name: '', description: '', startDate: '', endDate: '', budget: '' });
    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty('error');
  });

  // Note: For a real test, you would need to authenticate and provide a valid token and organization context.
  // This is a scaffold; you may need to adjust for your auth middleware.
  it.skip('should create a new project (requires valid auth and org)', async () => {
    const token = 'YOUR_TEST_JWT_TOKEN'; // Replace with a real or mock token
    const res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Test Project',
        description: 'A test project',
        startDate: '2025-01-01',
        endDate: '2025-12-31',
        budget: 10000
      });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body).toHaveProperty('name', 'Test Project');
  });
}); 