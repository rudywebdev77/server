import mongoose from 'mongoose';

const ActivitySchema = new mongoose.Schema(
  {
    // Optional shop/workspace grouping (for multi-tenant scenarios)
    shop_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // The user who performed the action
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // High-level grouping (auth, request, project, profile, file, notification)
    module: {
      type: String,
      trim: true,
      default: 'system',
    },
    // Machine-readable action name e.g. "login", "project_created"
    action: {
      type: String,
      required: true,
      trim: true,
    },
    // Human-readable title shown on the timeline
    title: {
      type: String,
      required: true,
      trim: true,
    },
    // Descriptive sentence for the activity card
    description: {
      type: String,
      default: '',
      trim: true,
    },
    // Extra JSON payload (e.g. project name, request number, etc.)
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    // Network / device info
    ipAddress: {
      type: String,
      default: '',
    },
    browser: {
      type: String,
      default: '',
    },
    device: {
      type: String,
      default: '',
    },
    operatingSystem: {
      type: String,
      default: '',
    },
    // Category badge  (maps to colour + icon on the frontend)
    activityType: {
      type: String,
      enum: [
        'login',
        'logout',
        'profile_updated',
        'password_changed',
        'email_changed',
        'project_created',
        'project_updated',
        'project_deleted',
        'request_created',
        'request_updated',
        'file_uploaded',
        'file_deleted',
        'notification_read',
        'settings_updated',
        'system',
      ],
      default: 'system',
    },
    status: {
      type: String,
      enum: ['success', 'failed', 'pending'],
      default: 'success',
    },
  },
  {
    timestamps: true,
  }
);

// TTL index — automatically purge activity records older than 2 years
ActivitySchema.index({ createdAt: 1 }, { expireAfterSeconds: 2 * 365 * 24 * 3600 });

export default mongoose.model('Activity', ActivitySchema);
