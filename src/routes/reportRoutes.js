import express from 'express';
import { getProjectReports, getUserReports } from '../controllers/reportController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);
router.use(authorize('admin'));

router.get('/projects', getProjectReports);
router.get('/users', getUserReports);

export default router;
