import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary dynamically if environment variables exist
if (process.env.CLOUDINARY_URL) {
  cloudinary.config();
} else if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Uploads a file to Cloudinary if credentials exist, supporting both disk paths and memory buffers
 */
export const uploadFileToCloud = async (file) => {
  if (!file) return '';

  const isCloudConfigured = !!(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET)
  );

  if (isCloudConfigured) {
    try {
      let resourceType = 'auto';
      if (file.mimetype && (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/'))) {
        resourceType = 'video';
      } else if (file.mimetype && !file.mimetype.startsWith('image/')) {
        resourceType = 'raw';
      }

      if (file.path && fs.existsSync(file.path)) {
        const result = await cloudinary.uploader.upload(file.path, {
          folder: 'work_portal_uploads',
          resource_type: resourceType,
          use_filename: true,
        });

        try {
          fs.unlinkSync(file.path);
        } catch (unlinkErr) {}

        return result.secure_url;
      } else if (file.buffer) {
        return new Promise((resolve, reject) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'work_portal_uploads', resource_type: resourceType },
            (error, result) => {
              if (error) return resolve(`/uploads/${file.filename || 'file'}`);
              resolve(result.secure_url);
            }
          );
          stream.end(file.buffer);
        });
      }
    } catch (err) {
      console.error('[Cloudinary Upload Error]', err.message);
    }
  }

  // Local URL fallback
  return file.filename ? `/uploads/${file.filename}` : '';
};
