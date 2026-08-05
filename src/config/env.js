import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const PORT = process.env.PORT || 5000;
export const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/work_portal';
export const JWT_SECRET = process.env.JWT_SECRET || 'super_secret_jwt_key_12345';
export const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'super_secret_refresh_key_12345';
export const JWT_EXPIRE = process.env.JWT_EXPIRE || '24h';
export const JWT_REFRESH_EXPIRE = process.env.JWT_REFRESH_EXPIRE || '7d';
export const UPLOAD_PATH = process.env.UPLOAD_PATH || path.join(process.cwd(), 'uploads');
