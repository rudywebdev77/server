import express from 'express';
import {
  createProject,
  getProjects,
  getProject,
  updateProject,
  changeProjectStatus,
  assignStaff,
  acceptProject,
  submitForReview,
  approveWork,
  requestRevision,
} from '../controllers/projectController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

router.use(protect);

router.route('/')
  .get(getProjects)
  .post(authorize('admin'), upload.array('referenceFiles', 10), createProject);

router.route('/:id')
  .get(getProject)
  .put(authorize('admin'), updateProject);

router.patch('/:id/status', authorize('admin', 'staff'), changeProjectStatus);
router.patch('/:id/assign', authorize('admin'), assignStaff);
router.patch('/:id/accept', authorize('staff'), acceptProject);
router.patch('/:id/submit-review', authorize('staff'), upload.array('workFiles', 10), submitForReview);
router.patch('/:id/approve', authorize('admin', 'client'), approveWork);
router.patch('/:id/revision', authorize('admin', 'client'), requestRevision);

export default router;
