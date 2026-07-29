import express from 'express';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  toggleUserStatus,
  deleteUser,
} from '../controllers/userController.js';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();

// Restrict all routes in this file to Admin role
router.use(protect);
router.use(authorize('admin'));

router
  .route('/')
  .get(getUsers)
  .post(upload.single('profileImage'), createUser);

router
  .route('/:id')
  .get(getUser)
  .put(upload.single('profileImage'), updateUser)
  .delete(deleteUser);

router.patch('/:id/status', toggleUserStatus);

export default router;
