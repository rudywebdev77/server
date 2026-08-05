import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: [true, 'Please add a full name'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    password: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
      select: false, // Don't return password by default
    },
    role: {
      type: String,
      enum: ['admin', 'staff', 'client'],
      default: 'client',
    },
    profileImage: {
      type: String,
      default: '',
    },
    status: {
      type: String,
      enum: ['active', 'inactive', 'deactivated'],
      default: 'active',
    },
    isOnline: {
      type: Boolean,
      default: false,
    },
    lastSeen: {
      type: Date,
      default: Date.now,
    },
    refreshToken: {
      type: String,
      select: false,
    },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
    otpCode: String,
    otpExpires: Date,
    otpAttempts: {
      type: Number,
      default: 0,
    },
    otpResends: {
      type: Number,
      default: 0,
    },
    otpLastSentAt: Date,
    resetPasswordVerified: {
      type: Boolean,
      default: false,
    },
    emailVerified: {
      type: Boolean,
      default: true,
    },
    pendingEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    emailVerificationToken: String,
    emailVerificationExpires: Date,

    username: {
      type: String,
      trim: true,
      default: '',
    },
    lastPasswordChange: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: Date.now,
    },
    preferences: {
      theme: {
        type: String,
        enum: ['dark', 'light'],
        default: 'dark',
      },
      language: {
        type: String,
        default: 'English',
      },
      timezone: {
        type: String,
        default: 'UTC (GMT+00:00)',
      },
      dateFormat: {
        type: String,
        default: 'YYYY-MM-DD',
      },
    },
    notifications: {
      email: {
        type: Boolean,
        default: true,
      },
      browser: {
        type: Boolean,
        default: true,
      },
      projects: {
        type: Boolean,
        default: true,
      },
      security: {
        type: Boolean,
        default: true,
      },
      messages: {
        type: Boolean,
        default: true,
      },
      tasks: {
        type: Boolean,
        default: true,
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Encrypt password using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) {
    return next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  if (!enteredPassword || !this.password) return false;
  return await bcrypt.compare(enteredPassword, this.password);
};


export default mongoose.model('User', UserSchema);
