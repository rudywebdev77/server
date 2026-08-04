import bcrypt from 'bcryptjs';
import User from '../models/User.js';

// @desc    Get Client Profile
// @route   GET /api/client/profile
// @access  Private (Client)
export const getClientProfile = async (req, res, next) => {
  try {
    const client = await User.findById(req.user._id).select('-password');

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client profile not found',
      });
    }

    if (!client.notifications) {
      client.notifications = {
        email: true,
        browser: true,
        projects: true,
        messages: true,
      };
    }

    res.status(200).json({
      success: true,
      user: client,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Client Profile Information
// @route   PUT /api/client/profile
// @access  Private (Client)
export const updateClientProfile = async (req, res, next) => {
  try {
    const { fullName, phone } = req.body;

    const client = await User.findById(req.user._id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client user not found',
      });
    }

    if (fullName !== undefined) client.fullName = fullName;
    if (phone !== undefined) client.phone = phone;

    await client.save();

    const updatedUser = await User.findById(client._id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile information updated successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change Client Password
// @route   PUT /api/client/change-password
// @access  Private (Client)
export const changeClientPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password, new password, and confirmation password are required',
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

    const client = await User.findById(req.user._id).select('+password');

    const isMatch = await client.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const isSame = await client.matchPassword(newPassword);

    if (isSame) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from your current password',
      });
    }

    client.password = newPassword;
    client.lastPasswordChange = new Date();

    await client.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload Client Profile Picture
// @route   POST /api/client/upload-profile-image
// @access  Private (Client)
export const uploadClientProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file',
      });
    }

    const client = await User.findById(req.user._id);
    client.profileImage = req.file.filename;
    await client.save();

    const updatedUser = await User.findById(client._id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profileImage: client.profileImage,
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Client Notification Settings
// @route   PUT /api/client/notifications
// @access  Private (Client)
export const updateClientNotifications = async (req, res, next) => {
  try {
    const { email, browser, projects, messages } = req.body;

    const client = await User.findById(req.user._id);

    if (!client) {
      return res.status(404).json({
        success: false,
        message: 'Client user not found',
      });
    }

    client.notifications = {
      email: email !== undefined ? Boolean(email) : (client.notifications?.email ?? true),
      browser: browser !== undefined ? Boolean(browser) : (client.notifications?.browser ?? true),
      projects: projects !== undefined ? Boolean(projects) : (client.notifications?.projects ?? true),
      messages: messages !== undefined ? Boolean(messages) : (client.notifications?.messages ?? true),
    };

    await client.save();

    const updatedUser = await User.findById(client._id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Notification settings saved successfully',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};
