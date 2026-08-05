import multer from 'multer';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { UPLOAD_PATH } from '../config/env.js';

// Setup storage options with serverless /tmp fallback
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    let destPath = UPLOAD_PATH;
    try {
      if (!fs.existsSync(destPath)) {
        fs.mkdirSync(destPath, { recursive: true });
      }
      // Strictly test write permissions on the directory
      fs.accessSync(destPath, fs.constants.W_OK);
    } catch (e) {
      // Fallback to OS temp directory (/tmp) which is guaranteed writable on Vercel/Lambda
      destPath = os.tmpdir();
    }
    cb(null, destPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});



// File filter (Optional validation, can be customized depending on endpoint)
const fileFilter = (req, file, cb) => {
  // Allow all general file uploads: pdf, images, zip, docx, etc.
  const allowedExtensions = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip|rar|webm|mp3|wav|ogg|m4a|aac|mp4|mov|avi|mkv/;
  const extname = allowedExtensions.test(
    path.extname(file.originalname).toLowerCase()
  );
  const mimetype = allowedExtensions.test(file.mimetype);

  if (extname || mimetype) {
    return cb(null, true);
  } else {
    cb(new Error('Error: File extension not supported!'));
  }
};

export const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: fileFilter,
});
