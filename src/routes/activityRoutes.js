import express from 'express';
import { getClientActivities, getActivityStats } from '../controllers/activityController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication — any role may view their own activities
router.use(protect);

router.get('/stats', getActivityStats);
router.get('/',      getClientActivities);

export default router;
