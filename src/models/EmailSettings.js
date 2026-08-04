import mongoose from 'mongoose';
import crypto from 'crypto';

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'work_portal_secret_key_32_bytes!'; // 32 chars
const IV_LENGTH = 16;

const encrypt = (text) => {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
};

const decrypt = (text) => {
  if (!text || !text.includes(':')) return text;
  try {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = textParts.join(':');
    const key = crypto.scryptSync(ENCRYPTION_KEY, 'salt', 32);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    return text;
  }
};

const emailSettingsSchema = new mongoose.Schema(
  {
    provider: {
      type: String,
      enum: ['gmail', 'outlook', 'custom'],
      default: 'custom',
    },
    senderName: {
      type: String,
      required: true,
      default: 'Work Portal',
      trim: true,
    },
    senderEmail: {
      type: String,
      required: true,
      default: 'noreply@portal.com',
      trim: true,
    },
    replyToEmail: {
      type: String,
      default: '',
      trim: true,
    },
    smtpHost: {
      type: String,
      required: true,
      default: 'smtp.gmail.com',
      trim: true,
    },
    smtpPort: {
      type: Number,
      required: true,
      default: 587,
    },
    encryption: {
      type: String,
      enum: ['TLS', 'SSL', 'None'],
      default: 'TLS',
    },
    smtpUsername: {
      type: String,
      required: [true, 'SMTP Username is required'],
      default: '',
      trim: true,
    },
    smtpPasswordEncrypted: {
      type: String,
      default: '',
    },
    connectionTimeout: {
      type: Number,
      default: 10000,
    },
    isConfigured: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

// Virtual for getting decrypted password
emailSettingsSchema.methods.getDecryptedPassword = function () {
  return decrypt(this.smtpPasswordEncrypted);
};

// Method for setting encrypted password
emailSettingsSchema.methods.setEncryptedPassword = function (plainPassword) {
  this.smtpPasswordEncrypted = encrypt(plainPassword);
};

export default mongoose.model('EmailSettings', emailSettingsSchema);
