import express from 'express';
import { protect, authorize } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';
import { getCompanyBranding, updateCompanyBranding } from '../controllers/companyController.js';

const router = express.Router();

// Get Company Branding (Public / All Authenticated Users)
router.get('/', getCompanyBranding);

// Update Company Branding (Strictly Admin Only with Logo Upload)
router.put('/', protect, authorize('admin'), upload.single('logo'), updateCompanyBranding);

export default router;
