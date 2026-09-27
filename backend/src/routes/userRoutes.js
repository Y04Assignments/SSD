import express from 'express';
import {
  register,
  login,
  getProfile,
  getAllUsers,
  verifyEmail,
  resendVerificationEmail,
  forgotPassword,
  resetPassword,
  getSessionFromCookie,
  logoutUser,
} from '../controllers/userController.js';
import { protect, authorize } from '../../middleware/auth.js';
import { validateRegister, validateLogin } from '../../middleware/validation.js';
import { body } from 'express-validator';
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // each IP may make at most 10 requests per window
  standardHeaders: true, 
  legacyHeaders: false, 
});

const router = express.Router();

// @route   POST /api/users/register
// @desc    Register a new user
// @access  Public
router.post('/register', authLimiter,validateRegister, register);

// @route   POST /api/users/login
// @desc    Login user
// @access  Public
router.post('/login', authLimiter,validateLogin, login);

// @route   GET /api/users/session
// @desc    Restore session from the httpOnly cookie on page load
// @access  Public
router.get('/session', getSessionFromCookie);

// @route   POST /api/users/logout
// @desc    Clear the httpOnly auth cookie
// @access  Public
router.post('/logout', logoutUser);

// @route   GET /api/users/verify-email/:token
// @desc    Verify email address
// @access  Public
router.get('/verify-email/:token', verifyEmail);

// @route   POST /api/users/resend-verification
// @desc    Resend verification email
// @access  Public
router.post(
  '/resend-verification',
  [body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address')],
  resendVerificationEmail
);

// @route   GET /api/users/profile
// @desc    Get user profile
// @access  Private
router.get('/profile', protect, getProfile);

// @route   GET /api/users
// @desc    Get all users (admin only)
// @access  Private (Admin only)
router.get('/', protect, authorize('admin'), getAllUsers);

// @route   PATCH /api/users/:id/promote
// @desc    Promote a user to admin
// @access  Private (Admin only)
router.patch('/:id/promote', protect, authorize('admin'), (req, res, next) => {
  // lazy-load controller to avoid circular deps in some setups
  import('../controllers/userController.js').then(mod => mod.promoteUser(req, res)).catch(next);
});

// @route   PATCH /api/users/:id/role
// @desc    Update a user's role (admin <-> user)
// @access  Private (Admin only)
router.patch('/:id/role', protect, authorize('admin'), (req, res, next) => {
  import('../controllers/userController.js').then(mod => mod.updateUserRole(req, res)).catch(next);
});

// @route   POST /api/users/forgot-password
// @desc    Send password reset code
// @access  Public
router.post(
  '/forgot-password', authLimiter,
  [body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address')],
  forgotPassword
);

// @route   POST /api/users/reset-password
// @desc    Reset password with code
// @access  Public
router.post(
  '/reset-password', authLimiter,
  [
    body('email').isEmail().normalizeEmail().withMessage('Please provide a valid email address'),
    body('resetCode').isLength({ min: 6, max: 6 }).withMessage('Reset code must be 6 digits'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters long'),
  ],
  resetPassword
);

export default router;
