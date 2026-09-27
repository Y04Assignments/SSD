import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { handleFacebookAuth } from '../config/passport.js';
import User from '../src/models/User.js';

describe('Facebook OAuth Security & Account Linking Tests', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('MUST create a new Facebook user with role "user"', async () => {
    const profile = {
      id: 'facebook-uid-1001',
      displayName: 'New Facebook User',
      emails: [{ value: 'NewUser@Example.COM' }],
    };

    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    const save = jest.fn(async function () {
      return this;
    });

    jest.spyOn(User.prototype, 'save').mockImplementation(save);

    const done = jest.fn();

    await handleFacebookAuth('mock-access-token', 'mock-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(null, expect.any(Object));

    const user = done.mock.calls[0][1];

    expect(user.facebookId).toBe('facebook-uid-1001');
    expect(user.email).toBe('newuser@example.com');
    expect(user.name).toBe('New Facebook User');
    expect(user.role).toBe('user');
    expect(user.role).not.toBe('admin');
    expect(user.isEmailVerified).toBe(true);
    expect(save).toHaveBeenCalled();
  });

  it('MUST return an existing Facebook-linked account without creating a new user', async () => {
    const profile = {
      id: 'facebook-uid-1002',
      displayName: 'Existing Facebook User',
      emails: [{ value: 'existing@example.com' }],
    };

    const existingUser = {
      _id: 'user-1002',
      email: 'existing@example.com',
      facebookId: 'facebook-uid-1002',
      role: 'user',
    };

    const findOne = jest.spyOn(User, 'findOne').mockResolvedValueOnce(existingUser);

    const done = jest.fn();

    await handleFacebookAuth('mock-access-token', 'mock-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(null, existingUser);
    expect(findOne).toHaveBeenCalledWith({
      facebookId: 'facebook-uid-1002',
    });
  });

  it('MUST reject linking Facebook to an existing unverified local account', async () => {
    const profile = {
      id: 'facebook-uid-1003',
      displayName: 'Unverified Target',
      emails: [{ value: 'unverified@example.com' }],
    };

    const unverifiedUser = {
      _id: 'local-u3',
      email: 'unverified@example.com',
      isEmailVerified: false,
      facebookId: null,
      role: 'user',
    };

    jest.spyOn(User, 'findOne').mockResolvedValueOnce(null).mockResolvedValueOnce(unverifiedUser);

    const done = jest.fn();

    await handleFacebookAuth('mock-access-token', 'mock-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/not verified/i),
      }),
      null
    );
  });

  it('MUST allow linking Facebook to an existing verified account', async () => {
    const profile = {
      id: 'facebook-uid-1004',
      displayName: 'Verified Target',
      emails: [{ value: 'verified@example.com' }],
    };

    const verifiedUser = {
      _id: 'local-u4',
      email: 'verified@example.com',
      isEmailVerified: true,
      facebookId: null,
      role: 'user',
      save: jest.fn(async () => true),
    };

    jest.spyOn(User, 'findOne').mockResolvedValueOnce(null).mockResolvedValueOnce(verifiedUser);

    const done = jest.fn();

    await handleFacebookAuth('mock-access-token', 'mock-refresh-token', profile, done);

    expect(verifiedUser.facebookId).toBe('facebook-uid-1004');
    expect(verifiedUser.save).toHaveBeenCalled();
    expect(done).toHaveBeenCalledWith(null, verifiedUser);
  });

  it('MUST reject a Facebook profile without an email address', async () => {
    const profile = {
      id: 'facebook-uid-1005',
      displayName: 'No Email User',
      emails: [],
    };

    jest.spyOn(User, 'findOne').mockResolvedValue(null);

    const done = jest.fn();

    await handleFacebookAuth('mock-access-token', 'mock-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/no email/i),
      }),
      null
    );
  });

  it('MUST reject an invalid Facebook profile without an ID', async () => {
    const profile = {
      displayName: 'Invalid Facebook User',
      emails: [{ value: 'invalid@example.com' }],
    };

    const done = jest.fn();

    await handleFacebookAuth('mock-access-token', 'mock-refresh-token', profile, done);

    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringMatching(/invalid facebook profile/i),
      }),
      null
    );
  });
});
