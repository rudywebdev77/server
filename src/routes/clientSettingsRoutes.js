import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import {
  getClientProfile,
  updateClientProfile,
  changeClientPassword,
  uploadClientProfileImage,
  updateClientNotifications,
} from '../controllers/clientSettingsController.js';

const router = express.Router();

// Protect and restrict to client role
router.use(protect);
router.use(authorize('client'));

router.get('/profile', getClientProfile);
router.put('/profile', updateClientProfile);
router.put('/change-password', changeClientPassword);
router.post('/upload-profile-image', upload.single('profileImage'), uploadClientProfileImage);
router.put('/notifications', updateClientNotifications);

export default router;
