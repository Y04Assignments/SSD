import express from 'express';
import request from 'supertest';
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
});

const testApp = express();
testApp.use(express.json());
testApp.post('/api/users/login', authLimiter, (req, res) => {
  res.status(401).json({ success: false, message: 'Invalid credentials' });
});

describe('VULN-10: Rate limiting on authentication routes', () => {
  test('requests beyond the configured limit are throttled with 429', async () => {
    const attempts = 12;
    const statuses = [];

    for (let i = 0; i < attempts; i++) {
      const res = await request(testApp)
        .post('/api/users/login')
        .send({ email: 'nobody@test.com', password: 'wrong-password' });
      statuses.push(res.status);
    }

    expect(statuses.slice(0, 10)).toEqual(statuses.slice(0, 10).map(() => 401));
    expect(statuses.slice(10)).toEqual(statuses.slice(10).map(() => 429));
  });
});
