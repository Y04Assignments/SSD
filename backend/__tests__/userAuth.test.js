// @ts-nocheck
/// <reference types="jest" />
import { jest, describe, test, expect, beforeAll, beforeEach, afterAll } from '@jest/globals';

// Mocks used by the controller
const mockFindOne = jest.fn();
const mockCreate = jest.fn();
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
    create: mockCreate,
    findById: mockFindById,
    prototype: { comparePassword: mockComparePassword },
  },
}));

const mockSendVerificationEmail = jest.fn();
const mockSendPasswordResetEmail = jest.fn();

jest.unstable_mockModule('../src/utils/emailService.js', () => ({
  __esModule: true,
  sendVerificationEmail: mockSendVerificationEmail,
  sendPasswordResetEmail: mockSendPasswordResetEmail,
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
  return res;
};

describe('User Auth Controller', () => {
  beforeEach(() => jest.clearAllMocks());

  test('register returns 400 when user already exists', async () => {
    mockFindOne.mockResolvedValue({ email: 'a@a.com' });
    const req = { body: { email: 'a@a.com', password: 'secret' } };
    const res = mockRes();

    await controllers.register(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('register success calls sendVerificationEmail', async () => {
    mockFindOne.mockResolvedValue(null);
    const fakeUser = { _id: 'u1', email: 'x@x.com', role: 'user', isEmailVerified: false };
    mockCreate.mockResolvedValue(fakeUser);

    const req = { body: { email: 'x@x.com', password: 'password' } };
    const res = mockRes();

    await controllers.register(req, res);

    expect(mockCreate).toHaveBeenCalled();
    expect(mockSendVerificationEmail).toHaveBeenCalledWith(expect.objectContaining({ _id: 'u1' }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('login returns 401 for unknown user', async () => {
    mockFindOne.mockResolvedValue(null);
    const req = { body: { email: 'no@no.com', password: 'p' } };
    const res = mockRes();

    await controllers.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('login returns 401 for wrong password', async () => {
    const userObj = { _id: 'u1', email: 'u@u.com', isEmailVerified: true };
    mockFindOne.mockResolvedValue(userObj);
    mockComparePassword.mockResolvedValue(false);

    const req = { body: { email: 'u@u.com', password: 'wrong' } };
    const res = mockRes();

    await controllers.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
  });

  test('login returns 401 if email not verified', async () => {
    const userObj = { _id: 'u1', email: 'u@u.com', isEmailVerified: false };
    mockFindOne.mockResolvedValue(userObj);
    mockComparePassword.mockResolvedValue(true);

    const req = { body: { email: 'u@u.com', password: 'right' } };
    const res = mockRes();

    await controllers.login(req, res);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: false }));
  });

  test('verifyEmail returns 400 for invalid/expired token', async () => {
    mockFindById.mockResolvedValue(null);
    const req = { params: { token: 'bad' } };
    const res = mockRes();

    // controllers.verifyEmail looks up User.findOne by token; our mockFindById isn't used here,
    // so mock the User model method directly by replacing mockFindOne to return null
    mockFindOne.mockResolvedValue(null);

    await controllers.verifyEmail(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('forgotPassword returns 404 when user not found', async () => {
    mockFindOne.mockResolvedValue(null);
    const req = { body: { email: 'no@no.com' } };
    const res = mockRes();

    await controllers.forgotPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('forgotPassword success sends reset email', async () => {
    const userObj = { _id: 'u1', email: 'u@u.com', save: jest.fn() };
    mockFindOne.mockResolvedValue(userObj);
    const req = { body: { email: 'u@u.com' } };
    const res = mockRes();

    await controllers.forgotPassword(req, res);

    expect(mockSendPasswordResetEmail).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
  });

  test('resetPassword returns 400 for invalid/expired code', async () => {
    mockFindOne.mockResolvedValue(null);
    const req = { body: { email: 'x@x.com', resetCode: '000000', newPassword: 'newpass' } };
    const res = mockRes();

    await controllers.resetPassword(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('V01: Registration successfully forces default "user" role and ignores "admin" input', async () => {
    mockFindOne.mockResolvedValue(null);
    const req = { body: { email: 'hacker@x.com', password: 'password', role: 'admin' } };
    const res = mockRes();

    mockCreate.mockResolvedValue({ _id: 'u2', email: 'hacker@x.com', role: 'user', isEmailVerified: false });

    await controllers.register(req, res);

    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      email: 'hacker@x.com',
      password: 'password',
      role: 'user' // The critical security property: MUST be user, not admin
    }));
    expect(res.status).toHaveBeenCalledWith(201);
  });

  test('V04: Password reset rejects invalid codes and locks account after exactly 5 attempts', async () => {
    // A mock user representing an active password reset flow
    const testUser = {
      _id: 'u-brute',
      email: 'target@example.com',
      passwordResetToken: 'dummy_hash_for_test', // Invalid hash mismatch
      passwordResetExpires: new Date(Date.now() + 1000 * 60 * 10), // valid expiry
      passwordResetAttempts: 0,
      passwordResetLockUntil: null,
      save: jest.fn().mockImplementation(function() { return Promise.resolve(this); })
    };

    mockFindOne.mockResolvedValue(testUser);
    
    // Perform 4 invalid attempts
    for (let i = 1; i <= 4; i++) {
      const req = { body: { email: 'target@example.com', resetCode: '000000', newPassword: 'newpass' } };
      const res = mockRes();
      await controllers.resetPassword(req, res);
      
      expect(res.status).toHaveBeenCalledWith(400); // Bad Request (invalid code)
      expect(testUser.passwordResetAttempts).toBe(i);
      expect(testUser.passwordResetLockUntil).toBeNull();
    }

    // Perform the 5th invalid attempt (The threshold)
    const req5 = { body: { email: 'target@example.com', resetCode: '000000', newPassword: 'newpass' } };
    const res5 = mockRes();
    await controllers.resetPassword(req5, res5);
    
    // Attempt 5 should lock the account and return 429 Too Many Requests
    expect(res5.status).toHaveBeenCalledWith(429);
    expect(res5.json).toHaveBeenCalledWith(expect.objectContaining({
      message: expect.stringMatching(/Too many failed attempts/i)
    }));
    expect(testUser.passwordResetLockUntil).not.toBeNull();
    expect(testUser.passwordResetToken).toBeNull(); // Token invalidated

    // Perform a 6th attempt to verify it stays locked
    const req6 = { body: { email: 'target@example.com', resetCode: '000000', newPassword: 'newpass' } };
    const res6 = mockRes();
    await controllers.resetPassword(req6, res6);
    expect(res6.status).toHaveBeenCalledWith(429); // Remains 429
  });
});
