import express from 'express';
import {
  register,
  login,
  logout,
  refreshToken,
  getMe,
  forgotPassword,
  verifyOtp,
  resetPassword,
  verifyEmail,
  resendEmailVerification,
  cancelEmailVerification,
} from '../controllers/authController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.post('/login', login);
router.post('/logout', logout);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.post('/refresh-token', refreshToken);
router.post('/verify-email', verifyEmail);

// Protected routes
router.get('/me', protect, getMe);
router.post('/resend-verification', protect, resendEmailVerification);
router.post('/cancel-verification', protect, cancelEmailVerification);
router.post('/register', protect, authorize('admin'), register);

export default router;

