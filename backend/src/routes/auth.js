import express from 'express';
import passport from '../../config/passport.js';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const router = express.Router();

// Short-lived single-use authorization code store (TTL: 60s)
export const oauthAuthCodes = new Map();

// Google OAuth initiate
router.get(
  '/google',
  passport.authenticate('google', /** @type {any} */ ({ scope: ['profile', 'email'] }))
);

// Google OAuth callback
router.get(
  '/google/callback',
  passport.authenticate('google', {
    failureRedirect: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/auth?error=auth_failed`,
  }),
  async (req, res) => {
    try {
      /** @type {any} */
      const user = req.user;
      const userData = {
        id: user._id.toString(),
        email: user.email,
        name: user.name,
        role: user.role,
      };

      // @ts-ignore
      const token = jwt.sign(userData, process.env.JWT_SECRET, {
        expiresIn: process.env.JWT_EXPIRE || '30d',
      });

      // Generate single-use, high-entropy authorization code
      const authCode = crypto.randomBytes(32).toString('hex');
      oauthAuthCodes.set(authCode, {
        token,
        user: userData,
        expiresAt: Date.now() + 60000, // 60s TTL
      });

      // Also set secure HttpOnly cookie for session security
      res.cookie('token', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60 * 1000,
      });

      // Secure redirect: NEVER contains token or user JSON in URL
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/oauth/callback?code=${authCode}`);
    } catch (error) {
      process.stderr.write(
        `Google OAuth error: ${error instanceof Error ? error.message : String(error)}\n`
      );
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
      res.redirect(`${frontendUrl}/auth?error=auth_failed`);
    }
  }
);

// Exchange single-use authorization code for session token
router.post('/exchange', async (req, res) => {
  try {
    const { code } = req.body;

    if (!code || typeof code !== 'string') {
      return res.status(400).json({ success: false, message: 'Authorization code is required' });
    }

    const entry = oauthAuthCodes.get(code);

    if (!entry) {
      return res
        .status(400)
        .json({ success: false, message: 'Invalid or expired authorization code' });
    }

    // Immediately remove code to guarantee single-use redemption
    oauthAuthCodes.delete(code);

    if (entry.expiresAt <= Date.now()) {
      return res
        .status(400)
        .json({ success: false, message: 'Authorization code has expired' });
    }

    return res.status(200).json({
      success: true,
      token: entry.token,
      user: entry.user,
    });
  } catch (error) {
    process.stderr.write(
      `Exchange error: ${error instanceof Error ? error.message : String(error)}\n`
    );
    return res.status(500).json({ success: false, message: 'Server error during code exchange' });
  }
});

export default router;
