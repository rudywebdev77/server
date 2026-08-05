import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

// Configure Cloudinary dynamically if environment variables exist
if (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
}

/**
 * Uploads a file to Cloudinary if credentials exist, otherwise returns local URL
 */
export const uploadFileToCloud = async (file) => {
  if (!file) return '';

  const isCloudConfigured = !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );

  if (isCloudConfigured && file.path && fs.existsSync(file.path)) {
    try {
      // Audio & Video require resource_type: 'video' or 'raw'
      let resourceType = 'auto';
      if (file.mimetype.startsWith('video/') || file.mimetype.startsWith('audio/')) {
        resourceType = 'video';
      } else if (!file.mimetype.startsWith('image/')) {
        resourceType = 'raw';
      }

      const result = await cloudinary.uploader.upload(file.path, {
        folder: 'work_portal_uploads',
        resource_type: resourceType,
        use_filename: true,
      });

      // Cleanup local temp file after cloud upload
      try {
        fs.unlinkSync(file.path);
      } catch (unlinkErr) {}

      return result.secure_url;
    } catch (err) {
      console.error('[Cloudinary Upload Error]', err.message);
    }
  }

  // Local URL fallback
  return `/uploads/${file.filename}`;
};
