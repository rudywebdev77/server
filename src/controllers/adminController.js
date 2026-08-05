import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { sendVerificationEmail } from './authController.js';

// @desc    Get Admin Profile
// @route   GET /api/admin/profile
// @access  Private (Admin)
export const getAdminProfile = async (req, res, next) => {
  try {
    const admin = await User.findById(req.user._id).select('-password');

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin profile not found',
      });
    }

    // Ensure default preferences and notifications structures
    if (!admin.preferences) {
      admin.preferences = {
        theme: 'dark',
        language: 'English',
        timezone: 'UTC (GMT+00:00)',
        dateFormat: 'YYYY-MM-DD',
      };
    }
    if (!admin.notifications) {
      admin.notifications = {
        email: true,
        browser: true,
        projects: true,
        security: true,
      };
    }

    res.status(200).json({
      success: true,
      user: admin,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Admin Profile Information
// @route   PUT /api/admin/profile
// @access  Private (Admin)
export const updateAdminProfile = async (req, res, next) => {
  try {
    console.log('==================================================');
    console.log('[DEBUG Backend] Request payload received by updateAdminProfile:', req.body);
    const { fullName, username, phone, email, currentPassword } = req.body;

    const admin = await User.findById(req.user._id).select('+password');

    if (!admin) {
      console.log('[DEBUG Backend] Admin user not found for ID:', req.user._id);
      return res.status(404).json({
        success: false,
        message: 'Admin user not found',
      });
    }

    console.log(`[DEBUG Backend] Current database email before update: "${admin.email}"`);

    // Process Email Change
    if (email !== undefined && email !== null) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: 'Email address is required',
        });
      }
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email address',
        });
      }

      // If email is different from current active email
      if (normalizedEmail !== admin.email) {
        console.log(`[DEBUG Backend] Attempting email change from "${admin.email}" to "${normalizedEmail}"`);

        // If current password is provided, verify it
        if (currentPassword) {
          const isPasswordValid = await admin.matchPassword(currentPassword);
          if (!isPasswordValid) {
            console.log('[DEBUG Backend] Current password verification failed');
            return res.status(400).json({
              success: false,
              message: 'Current password is incorrect',
            });
          }
        }

        // Check if email already exists for another user
        const emailExists = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: req.user._id },
        });

        if (emailExists) {
          console.log(`[DEBUG Backend] Email "${normalizedEmail}" is already in use by user ID: ${emailExists._id}`);
          return res.status(400).json({
            success: false,
            message: 'This email address is already in use by another account',
          });
        }

        // Update email directly in MongoDB document
        admin.email = normalizedEmail;
        admin.pendingEmail = undefined;
        admin.emailVerificationToken = undefined;
        admin.emailVerificationExpires = undefined;
        admin.emailVerified = true;

        console.log(`[DEBUG Backend] admin.email successfully updated on document to: "${admin.email}"`);
      }

    }

    // Check if username already taken by another user
    if (username && username !== admin.username) {
      const usernameExists = await User.findOne({
        username,
        _id: { $ne: req.user._id },
      });

      if (usernameExists) {
        return res.status(400).json({
          success: false,
          message: 'Username is already taken by another account',
        });
      }
      admin.username = username;
    }

    if (fullName !== undefined) admin.fullName = fullName;
    if (phone !== undefined) admin.phone = phone;

    console.log('[DEBUG Backend] Data passed into database save/update query:', {
      _id: admin._id,
      fullName: admin.fullName,
      username: admin.username,
      phone: admin.phone,
      email: admin.email,
    });

    await admin.save();

    const updatedUser = await User.findById(admin._id).select('-password');
    console.log('[DEBUG Backend] Updated document returned from MongoDB:', {
      _id: updatedUser?._id,
      fullName: updatedUser?.fullName,
      email: updatedUser?.email,
      phone: updatedUser?.phone,
      username: updatedUser?.username,
    });

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: 'Failed to retrieve updated profile document from database',
      });
    }

    const responsePayload = {
      success: true,
      message: 'Profile information updated successfully',
      user: updatedUser,
    };

    console.log('[DEBUG Backend] Response sent back to frontend:', responsePayload);
    console.log('==================================================');

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('[DEBUG Backend] Error updating admin profile:', error);
    next(error);
  }
};



// @desc    Change Admin Password
// @route   PUT /api/admin/change-password
// @access  Private (Admin)
export const changeAdminPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirmation password are all required',
      });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'New password and confirm password do not match',
      });
    }

    const admin = await User.findById(req.user._id).select('+password');

    const isMatch = await admin.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const isSame = await admin.matchPassword(newPassword);

    if (isSame) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from your current password',
      });
    }

    admin.password = newPassword;
    admin.lastPasswordChange = new Date();

    await admin.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload Profile Image
// @route   POST /api/admin/upload-profile-image
// @access  Private (Admin)
export const uploadAdminProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file',
      });
    }

    const admin = await User.findById(req.user._id);
    admin.profileImage = req.file.filename;
    await admin.save();

    const updatedUser = await User.findById(admin._id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profileImage: admin.profileImage,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Preferences
// @route   PUT /api/admin/preferences
// @access  Private (Admin)
export const updateAdminPreferences = async (req, res, next) => {
  try {
    const { theme, language, timezone, dateFormat } = req.body;

    const admin = await User.findById(req.user._id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found',
      });
    }

    admin.preferences = {
      theme: theme || admin.preferences?.theme || 'dark',
      language: language || admin.preferences?.language || 'English',
      timezone: timezone || admin.preferences?.timezone || 'UTC (GMT+00:00)',
      dateFormat: dateFormat || admin.preferences?.dateFormat || 'YYYY-MM-DD',
    };

    await admin.save();

    const updatedUser = await User.findById(admin._id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Preferences saved successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Notification Settings
// @route   PUT /api/admin/notifications
// @access  Private (Admin)
export const updateAdminNotifications = async (req, res, next) => {
  try {
    const { email, browser, projects, security } = req.body;

    const admin = await User.findById(req.user._id);

    if (!admin) {
      return res.status(404).json({
        success: false,
        message: 'Admin user not found',
      });
    }

    admin.notifications = {
      email: email !== undefined ? Boolean(email) : (admin.notifications?.email ?? true),
      browser: browser !== undefined ? Boolean(browser) : (admin.notifications?.browser ?? true),
      projects: projects !== undefined ? Boolean(projects) : (admin.notifications?.projects ?? true),
      security: security !== undefined ? Boolean(security) : (admin.notifications?.security ?? true),
    };

    await admin.save();

    const updatedUser = await User.findById(admin._id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Notification settings saved successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
