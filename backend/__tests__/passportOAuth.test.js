import { jest, describe, it, expect, beforeEach } from '@jest/globals';
import { handleGoogleAuth } from '../config/passport.js';
import User from '../src/models/User.js';

describe('V05: Google OAuth Security & Role Assignment Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('MUST assign role "user" and NEVER "admin" to new Google OAuth users', async () => {
    const profile = {
      id: 'google-uid-1001',
      displayName: 'New Google User',
      emails: [{ value: 'new_oauth_user@example.com' }],
    };

    const mockFindOne = jest.spyOn(User, 'findOne').mockResolvedValue(null);
    let createdUser = null;
    const mockSave = jest.fn(function () {
      createdUser = this;
      return Promise.resolve(this);
    });
    jest.spyOn(User.prototype, 'save').mockImplementation(mockSave);

    const done = jest.fn();
    await handleGoogleAuth('mock-access-token', 'mock-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(null, expect.any(Object));
    const userArg = done.mock.calls[0][1];
    expect(userArg.role).toBe('user');
    expect(userArg.role).not.toBe('admin');
    expect(userArg.email).toBe('new_oauth_user@example.com');
    expect(userArg.googleId).toBe('google-uid-1001');

    mockFindOne.mockRestore();
    User.prototype.save.mockRestore();
  });

  it('MUST reject blind linking to an existing unverified local account to prevent pre-account takeover', async () => {
    const profile = {
      id: 'google-uid-1002',
      displayName: 'Unverified Target',
      emails: [{ value: 'unverified_local@example.com' }],
    };

    const unverifiedUser = {
      _id: 'local-u1',
      email: 'unverified_local@example.com',
      isEmailVerified: false,
      role: 'user',
      googleId: null,
    };

    // First findOne for googleId returns null, second findOne for email returns unverifiedUser
    const mockFindOne = jest.spyOn(User, 'findOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(unverifiedUser);

    const done = jest.fn();
    await handleGoogleAuth('mock-access-token', 'mock-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({ message: expect.stringMatching(/not verified/i) }),
      null
    );

    mockFindOne.mockRestore();
  });

  it('allows linking to an existing verified account without granting admin escalation', async () => {
    const profile = {
      id: 'google-uid-1003',
      displayName: 'Verified Target',
      emails: [{ value: 'verified_local@example.com' }],
    };

    const verifiedUser = {
      _id: 'local-u2',
      email: 'verified_local@example.com',
      isEmailVerified: true,
      role: 'user',
      googleId: null,
      save: jest.fn().mockResolvedValue(true),
    };

    const mockFindOne = jest.spyOn(User, 'findOne')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(verifiedUser);

    const done = jest.fn();
    await handleGoogleAuth('mock-access-token', 'mock-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(null, verifiedUser);
    expect(verifiedUser.googleId).toBe('google-uid-1003');
    expect(verifiedUser.role).toBe('user');
    expect(verifiedUser.save).toHaveBeenCalled();

    mockFindOne.mockRestore();
  });
});
