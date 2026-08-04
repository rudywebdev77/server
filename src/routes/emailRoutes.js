import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import {
  getEmailSettings,
  updateEmailSettings,
  sendTestEmail,
} from '../controllers/emailController.js';

const router = express.Router();

// Apply auth protection & admin-only authorization to all email settings routes
router.use(protect);
router.use(authorize('admin'));

router.get('/', getEmailSettings);
router.put('/', updateEmailSettings);
router.post('/test', sendTestEmail);

export default router;
