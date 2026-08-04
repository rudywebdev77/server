import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  getStaffProfile,
  updateStaffProfile,
  changeStaffPassword,
  uploadStaffProfileImage,
  updateStaffNotifications,
} from '../controllers/staffSettingsController.js';

const router = express.Router();

// Protect and restrict to staff role
router.use(protect);
router.use(authorize('staff'));

router.get('/profile', getStaffProfile);
router.put('/profile', updateStaffProfile);
router.put('/change-password', changeStaffPassword);
router.post('/upload-profile-image', upload.single('profileImage'), uploadStaffProfileImage);
router.put('/notifications', updateStaffNotifications);

export default router;
