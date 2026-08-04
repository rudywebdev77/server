import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  getAdminProfile,
  updateAdminProfile,
  changeAdminPassword,
  uploadAdminProfileImage,
  updateAdminPreferences,
  updateAdminNotifications,
} from '../controllers/adminController.js';

const router = express.Router();

// Apply auth protection & admin authorization to all routes in this router
router.use(protect);
router.use(authorize('admin'));

router.get('/profile', getAdminProfile);
router.put('/profile', updateAdminProfile);
router.put('/change-password', changeAdminPassword);
router.post('/upload-profile-image', upload.single('profileImage'), uploadAdminProfileImage);
router.put('/preferences', updateAdminPreferences);
router.put('/notifications', updateAdminNotifications);

export default router;
