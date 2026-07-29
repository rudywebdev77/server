import express from 'express';
import { getProjectFiles, getRequestFiles, downloadFile, getAllFiles } from '../controllers/fileController.js';
import { protect, authorize } from '../middleware/auth.js';

const router = express.Router();
router.use(protect);

router.get('/', authorize('admin'), getAllFiles);
router.get('/project/:projectId', getProjectFiles);
router.get('/request/:requestId', getRequestFiles);
router.get('/download/:id', downloadFile);

export default router;
