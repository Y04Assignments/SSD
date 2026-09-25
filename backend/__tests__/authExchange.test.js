import { describe, it, expect, beforeEach } from '@jest/globals';
import request from 'supertest';
import express from 'express';
import authRoutes, { oauthAuthCodes } from '../src/routes/auth.js';

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

describe('V14: OAuth Code Exchange & Token Protection Tests', () => {
  beforeEach(() => {
    oauthAuthCodes.clear();
  });

  it('exchanges a valid authorization code for token and user', async () => {
    const testCode = 'auth_code_test_123';
    const testUserData = { id: 'u123', email: 'user@example.com', role: 'user' };
    const testToken = 'mock.jwt.token';

    oauthAuthCodes.set(testCode, {
      token: testToken,
      user: testUserData,
      expiresAt: Date.now() + 60000,
    });

    const res = await request(app)
      .post('/api/auth/exchange')
      .send({ code: testCode });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBe(testToken);
    expect(res.body.user).toEqual(testUserData);
  });

  it('enforces single-use consumption: redeemed code cannot be reused', async () => {
    const testCode = 'single_use_code_456';
    oauthAuthCodes.set(testCode, {
      token: 'jwt.token.val',
      user: { id: 'u456' },
      expiresAt: Date.now() + 60000,
    });

    // First redemption succeeds
    const res1 = await request(app)
      .post('/api/auth/exchange')
      .send({ code: testCode });
    expect(res1.status).toBe(200);

    // Second redemption fails with 400
    const res2 = await request(app)
      .post('/api/auth/exchange')
      .send({ code: testCode });
    expect(res2.status).toBe(400);
    expect(res2.body.message).toMatch(/invalid or expired/i);
  });

  it('rejects expired authorization codes', async () => {
    const testCode = 'expired_code_789';
    oauthAuthCodes.set(testCode, {
      token: 'jwt.token.val',
      user: { id: 'u789' },
      expiresAt: Date.now() - 5000, // Expired
    });

    const res = await request(app)
      .post('/api/auth/exchange')
      .send({ code: testCode });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/expired/i);
  });

  it('rejects missing or invalid code parameter', async () => {
    const res = await request(app)
      .post('/api/auth/exchange')
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });
});
