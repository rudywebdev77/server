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
 * Uploads a file to Cloudinary if credentials exist.
 * On serverless environments (Vercel) without Cloudinary, converts file to Base64 Data URI to prevent 404 EROFS errors.
 */
export const uploadFileToCloud = async (file) => {
  if (!file) return '';

  const isCloudConfigured = !!(
    process.env.CLOUDINARY_URL ||
    (process.env.CLOUDINARY_CLOUD_NAME &&
      process.env.CLOUDINARY_API_KEY &&
      process.env.CLOUDINARY_API_SECRET)
  );

  // 1. Try Cloudinary Upload if configured
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
        return new Promise((resolve) => {
          const stream = cloudinary.uploader.upload_stream(
            { folder: 'work_portal_uploads', resource_type: resourceType },
            (error, result) => {
              if (error || !result) return resolve('');
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

  // 2. Base64 Data URI fallback for serverless deployments (Vercel)
  if (file.path && fs.existsSync(file.path)) {
    try {
      const fileBuffer = fs.readFileSync(file.path);
      const mime = file.mimetype || 'image/jpeg';
      const base64Data = fileBuffer.toString('base64');
      const dataUri = `data:${mime};base64,${base64Data}`;

      // Clean up temp file
      try {
        fs.unlinkSync(file.path);
      } catch (unlinkErr) {}

      return dataUri;
    } catch (e) {
      console.error('[Base64 Fallback Error]', e.message);
    }
  } else if (file.buffer) {
    const mime = file.mimetype || 'image/jpeg';
    const base64Data = file.buffer.toString('base64');
    return `data:${mime};base64,${base64Data}`;
  }

  // 3. Default fallback
  return file.filename ? `/uploads/${file.filename}` : '';
};
