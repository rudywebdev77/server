import crypto from "crypto";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import { sendVerificationEmail } from "./authController.js";

// Get logged-in user's profile
export const getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

// Update profile
export const updateProfile = async (req, res, next) => {
  try {
    console.log('==================================================');
    console.log('[DEBUG Backend profileController] Request payload:', req.body);
    const {
      fullName,
      email,
      phone,
      currentPassword,
    } = req.body;

    const user = await User.findById(req.user._id).select("+password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    console.log(`[DEBUG Backend profileController] Database email before update: "${user.email}"`);

    // Process Email Change
    if (email !== undefined && email !== null) {
      const normalizedEmail = email.toLowerCase().trim();
      const emailRegex = /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/;

      if (!normalizedEmail) {
        return res.status(400).json({
          success: false,
          message: "Email address is required",
        });
      }
      if (!emailRegex.test(normalizedEmail)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address",
        });
      }

      if (normalizedEmail !== user.email) {
        console.log(`[DEBUG Backend profileController] Changing email from "${user.email}" to "${normalizedEmail}"`);
        if (currentPassword) {
          const isPasswordValid = await user.matchPassword(currentPassword);
          if (!isPasswordValid) {
            return res.status(400).json({
              success: false,
              message: "Current password is incorrect",
            });
          }
        }

        const emailExists = await User.findOne({
          email: normalizedEmail,
          _id: { $ne: req.user._id },
        });

        if (emailExists) {
          return res.status(400).json({
            success: false,
            message: "This email address is already in use by another account",
          });
        }

        user.email = normalizedEmail;
        user.pendingEmail = undefined;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        user.emailVerified = true;

        console.log(`[DEBUG Backend profileController] user.email set on document to: "${user.email}"`);
      }

    }

    if (fullName !== undefined) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;

    if (req.file) {
      user.profileImage = req.file.filename;
    }

    console.log('[DEBUG Backend profileController] Document before save:', {
      _id: user._id,
      fullName: user.fullName,
      email: user.email,
      phone: user.phone,
    });

    await user.save();

    const updatedUser = await User.findById(user._id).select("-password");

    console.log('[DEBUG Backend profileController] Document returned from MongoDB:', {
      _id: updatedUser?._id,
      fullName: updatedUser?.fullName,
      email: updatedUser?.email,
      phone: updatedUser?.phone,
    });

    if (!updatedUser) {
      return res.status(500).json({
        success: false,
        message: "Failed to retrieve updated profile from database",
      });
    }

    const responsePayload = {
      success: true,
      message: "Profile updated successfully",
      user: updatedUser,
    };

    console.log('[DEBUG Backend profileController] Response sent to frontend:', responsePayload);
    console.log('==================================================');

    res.status(200).json(responsePayload);
  } catch (error) {
    console.error('[DEBUG Backend profileController] Error updating profile:', error);
    next(error);
  }
};



// Change Password
export const changePassword = async (req, res, next) => {
  try {
    const {
      currentPassword,
      newPassword,
      confirmPassword,
    } = req.body;

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "All password fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match",
      });
    }

    const user = await User.findById(req.user._id);

    const matched = await bcrypt.compare(
      currentPassword,
      user.password
    );

    if (!matched) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    const samePassword = await bcrypt.compare(
      newPassword,
      user.password
    );

    if (samePassword) {
      return res.status(400).json({
        success: false,
        message: "New password must be different",
      });
    }

    user.password = await bcrypt.hash(newPassword, 12);

    await user.save();

    res.status(200).json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    next(error);
  }
};

// Upload Profile Picture
export const uploadProfileImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload an image",
      });
    }

    const user = await User.findById(req.user._id);

    user.profileImage = req.file.filename;

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile image uploaded successfully",
      profileImage: user.profileImage,
    });
  } catch (error) {
    next(error);
  }
};

// Delete Profile Picture
export const deleteProfileImage = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    user.profileImage = "";

    await user.save();

    res.status(200).json({
      success: true,
      message: "Profile image removed successfully",
    });
  } catch (error) {
    next(error);
  }
};