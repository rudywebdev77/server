import express from 'express';
import {
  getAdminStats,
  getStaffStats,
  getClientStats,
} from '../controllers/dashboardController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/admin', authorize('admin'), getAdminStats);
router.get('/staff', authorize('staff'), getStaffStats);
router.get('/client', authorize('client'), getClientStats);

export default router;
