import dotenv from 'dotenv';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../src/models/User.js';

// Load environment variables
dotenv.config();

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

/**
 * Verifies and handles Google OAuth authentication profile.
 * Enforces role: 'user' (least privilege) and verified account linking.
 */
export const handleGoogleAuth = async (accessToken, refreshToken, profile, done) => {
  try {
    if (!profile || !profile.id) {
      return done(new Error('Invalid Google profile data'), null);
    }

    // 1. Check if user is already linked with this googleId
    let user = await User.findOne({ googleId: profile.id });
    if (user) {
      return done(null, user);
    }

    const email = profile.emails?.[0]?.value?.toLowerCase();
    if (!email) {
      return done(new Error('No email found in Google profile'), null);
    }

    // 2. Check if user exists by email
    user = await User.findOne({ email });
    if (user) {
      // Require existing local accounts to be email-verified before linking to prevent pre-account takeover
      if (!user.isEmailVerified) {
        return done(
          new Error('Account email is not verified. Please verify your local account first.'),
          null
        );
      }

      if (!user.googleId) {
        user.googleId = profile.id;
        await user.save();
      }
      return done(null, user);
    }

    // 3. Create new user with least privilege (MUST be 'user', NEVER 'admin')
    user = new User({
      name: profile.displayName || email.split('@')[0],
      email: email,
      googleId: profile.id,
      isEmailVerified: true, // Google accounts provide verified email
      role: 'user', // Least privilege: MUST NEVER default to admin
    });

    await user.save();
    return done(null, user);
  } catch (error) {
    return done(error, null);
  }
};

// Only initialize GoogleStrategy if credentials are set (prevents failures during tests)
if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5001/api/auth/google/callback',
        scope: ['profile', 'email'],
      },
      handleGoogleAuth
    )
  );
}

passport.serializeUser((user, done) => {
  // @ts-ignore
  done(null, user._id);
});

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select('-password');
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
