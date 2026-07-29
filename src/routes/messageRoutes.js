import express from 'express';
import { sendMessage, getProjectMessages, markMessageRead } from '../controllers/messageController.js';
import { protect } from '../middleware/auth.js';
import { upload } from '../middleware/upload.js';

const router = express.Router();
router.use(protect);

router.post('/', upload.array('attachments', 5), sendMessage);
router.get('/project/:projectId', getProjectMessages);
router.patch('/:id/read', markMessageRead);

export default router;
