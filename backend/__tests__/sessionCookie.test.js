// @ts-nocheck
/// <reference types="jest" />
import { jest, describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';
import jwt from 'jsonwebtoken';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-for-jest';

const mockFindOne = jest.fn();
const mockFindById = jest.fn();
const mockComparePassword = jest.fn();

jest.unstable_mockModule('mongoose', () => ({
  __esModule: true,
  default: { connection: { readyState: 1 }, Types: { ObjectId: { isValid: () => true } } },
}));

jest.unstable_mockModule('../src/models/User.js', () => ({
  __esModule: true,
  default: {
    findOne: mockFindOne,
    findById: mockFindById,
    prototype: { comparePassword: mockComparePassword },
  },
}));

jest.unstable_mockModule('../src/utils/emailService.js', () => ({
  __esModule: true,
  sendVerificationEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  sendWelcomeEmail: jest.fn(),
}));

let controllers;
beforeAll(async () => {
  controllers = await import('../src/controllers/userController.js');
});

afterAll(() => jest.resetAllMocks());

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  return res;
};

describe('VULN-09: JWT session handling (httpOnly cookie, not localStorage-exposed)', () => {
  beforeEach(() => jest.clearAllMocks());

  test('login sets the token as an httpOnly cookie on success', async () => {
    const userObj = {
      _id: 'u1',
      email: 'u@u.com',
      role: 'user',
      isEmailVerified: true,
    };
    mockFindOne.mockResolvedValue(userObj);
    mockComparePassword.mockResolvedValue(true);

    const req = { body: { email: 'u@u.com', password: 'correct-password' } };
    const res = mockRes();

    await controllers.login(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.cookie).toHaveBeenCalledWith(
      'token',
      expect.any(String),
      expect.objectContaining({ httpOnly: true, sameSite: 'lax' })
    );
  });

  test('getSessionFromCookie restores the session from a valid httpOnly cookie', async () => {
    const userObj = {
      _id: 'u1',
      email: 'u@u.com',
      role: 'user',
      isEmailVerified: true,
    };
    mockFindById.mockResolvedValue(userObj);

    const validToken = jwt.sign({ id: 'u1' }, process.env.JWT_SECRET);
    const req = { cookies: { token: validToken } };
    const res = mockRes();

    await controllers.getSessionFromCookie(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        data: expect.objectContaining({
          user: expect.objectContaining({ email: 'u@u.com' }),
        }),
      })
    );
  });

  test('getSessionFromCookie clears the cookie and returns a null session for an invalid token', async () => {
    const req = { cookies: { token: 'not-a-real-jwt' } };
    const res = mockRes();

    await controllers.getSessionFromCookie(req, res);

    expect(res.clearCookie).toHaveBeenCalledWith('token');
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ user: null }) })
    );
  });

  test('logoutUser clears the auth cookie', async () => {
    const req = {};
    const res = mockRes();

    await controllers.logoutUser(req, res);

    expect(res.clearCookie).toHaveBeenCalledWith('token');
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
