import bcrypt from 'bcryptjs';
import User from '../models/User.js';

// @desc    Get Staff Profile
// @route   GET /api/staff/profile
// @access  Private (Staff)
export const getStaffProfile = async (req, res, next) => {
  try {
    const staff = await User.findById(req.user._id).select('-password');

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff profile not found',
      });
    }

    if (!staff.notifications) {
      staff.notifications = {
        email: true,
        browser: true,
        projects: true,
        tasks: true,
        messages: true,
      };
    }

    const staffId = staff._id ? `STF-${staff._id.toString().slice(-6).toUpperCase()}` : 'STF-000000';

    res.status(200).json({
      success: true,
      user: {
        ...staff.toObject(),
        staffId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Staff Profile Information
// @route   PUT /api/staff/profile
// @access  Private (Staff)
export const updateStaffProfile = async (req, res, next) => {
  try {
    const { fullName, phone } = req.body;

    const staff = await User.findById(req.user._id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found',
      });
    }

    if (fullName !== undefined) staff.fullName = fullName;
    if (phone !== undefined) staff.phone = phone;

    await staff.save();

    const updatedUser = await User.findById(staff._id).select('-password');
    const staffId = updatedUser._id ? `STF-${updatedUser._id.toString().slice(-6).toUpperCase()}` : 'STF-000000';

    res.status(200).json({
      success: true,
      message: 'Profile information updated successfully',
      user: {
        ...updatedUser.toObject(),
        staffId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Change Staff Password
// @route   PUT /api/staff/change-password
// @access  Private (Staff)
export const changeStaffPassword = async (req, res, next) => {
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

    const staff = await User.findById(req.user._id).select('+password');

    const isMatch = await staff.matchPassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect',
      });
    }

    const isSame = await staff.matchPassword(newPassword);

    if (isSame) {
      return res.status(400).json({
        success: false,
        message: 'New password must be different from your current password',
      });
    }

    staff.password = newPassword;
    staff.lastPasswordChange = new Date();

    await staff.save();

    res.status(200).json({
      success: true,
      message: 'Password updated successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Upload Staff Profile Picture
// @route   POST /api/staff/upload-profile-image
// @access  Private (Staff)
export const uploadStaffProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Please upload an image file',
      });
    }

    const staff = await User.findById(req.user._id);
    staff.profileImage = req.file.filename;
    await staff.save();

    const updatedUser = await User.findById(staff._id).select('-password');
    const staffId = updatedUser._id ? `STF-${updatedUser._id.toString().slice(-6).toUpperCase()}` : 'STF-000000';

    res.status(200).json({
      success: true,
      message: 'Profile picture uploaded successfully',
      profileImage: staff.profileImage,
      user: {
        ...updatedUser.toObject(),
        staffId,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update Staff Notification Settings
// @route   PUT /api/staff/notifications
// @access  Private (Staff)
export const updateStaffNotifications = async (req, res, next) => {
  try {
    const { email, browser, projects, tasks, messages } = req.body;

    const staff = await User.findById(req.user._id);

    if (!staff) {
      return res.status(404).json({
        success: false,
        message: 'Staff user not found',
      });
    }

    staff.notifications = {
      email: email !== undefined ? Boolean(email) : (staff.notifications?.email ?? true),
      browser: browser !== undefined ? Boolean(browser) : (staff.notifications?.browser ?? true),
      projects: projects !== undefined ? Boolean(projects) : (staff.notifications?.projects ?? true),
      tasks: tasks !== undefined ? Boolean(tasks) : (staff.notifications?.tasks ?? true),
      messages: messages !== undefined ? Boolean(messages) : (staff.notifications?.messages ?? true),
    };

    await staff.save();

    const updatedUser = await User.findById(staff._id).select('-password');
    const staffId = updatedUser._id ? `STF-${updatedUser._id.toString().slice(-6).toUpperCase()}` : 'STF-000000';

    res.status(200).json({
      success: true,
      message: 'Notification settings saved successfully',
      user: {
        ...updatedUser.toObject(),
        staffId,
      },
    });
  } catch (error) {
    next(error);
  }
};
