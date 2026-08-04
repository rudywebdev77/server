import mongoose from 'mongoose';

const companySettingsSchema = new mongoose.Schema(
  {
    companyName: {
      type: String,
      default: 'Work Portal',
      trim: true,
    },
    companyLogo: {
      type: String,
      default: '',
    },
    supportEmail: {
      type: String,
      default: '',
      trim: true,
    },
    supportPhone: {
      type: String,
      default: '',
      trim: true,
    },
    website: {
      type: String,
      default: '',
      trim: true,
    },
    companyAddress: {
      type: String,
      default: '',
      trim: true,
    },
    companyDescription: {
      type: String,
      default: '',
      trim: true,
    },
    companyTagline: {
      type: String,
      default: '',
      trim: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('CompanySettings', companySettingsSchema);
