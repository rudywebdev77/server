import express from 'express';
import {
  createRequest,
  getRequests,
  getRequest,
  reviewRequest,
} from '../controllers/requestController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

router
  .route('/')
  .get(authorize('admin', 'client'), getRequests)
  .post(authorize('client'), upload.array('files', 10), createRequest);

router.route('/:id').get(authorize('admin', 'client'), getRequest);

router.put('/:id/review', authorize('admin'), reviewRequest);

export default router;
