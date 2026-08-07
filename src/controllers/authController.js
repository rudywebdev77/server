import crypto from 'crypto';
import User from '../models/User.js';
import { sendTokenResponse } from '../utils/generateToken.js';
import jwt from 'jsonwebtoken';
import { JWT_REFRESH_SECRET } from '../config/env.js';

// @desc    Register a new user (Admin only or seed helper)
// @route   POST /api/auth/register
// @access  Private/Admin
export const register = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role, status } = req.body;

    // Check if user already exists
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User already exists' });
    }

    // Create user
    const user = await User.create({
      fullName,
      email,
      phone,
      password,
      role: role || 'client',
      status: status || 'active',
      createdBy: req.user ? req.user._id : null,
    });

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        status: user.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Signup a new client user
// @route   POST /api/auth/signup
// @access  Public
export const signup = async (req, res, next) => {
  try {
    const { fullName, email, phone, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide full name, email, and password' });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const userExists = await User.findOne({ email: cleanEmail });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'An account with this email already exists' });
    }

    const user = await User.create({
      fullName,
      email: cleanEmail,
      phone: phone || '',
      password,
      role: 'client',
      status: 'active',
    });

    await sendTokenResponse(user, 201, res);
  } catch (error) {
    next(error);
  }
};


// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
export const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Validate email & password
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide an email and password' });
    }

    // Check count and seed only if database has 0 users
    const count = await User.countDocuments();
    if (count === 0) {
      const { seedDatabase } = await import('../utils/seed.js');
      await seedDatabase();
    }

    // Check for user
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }


    // Check if status is active
    if (user.status === 'deactivated' || user.status === 'inactive') {
      return res.status(403).json({ success: false, message: 'Account is inactive or deactivated' });
    }

    // Check password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update lastLogin timestamp
    user.lastLogin = new Date();
    await user.save();

    // Send token response
    await sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Logout user & clear cookie
// @route   POST /api/auth/logout
// @access  Private
export const logout = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken;

    if (token) {
      const decoded = jwt.decode(token);
      if (decoded && decoded.id) {
        await User.findByIdAndUpdate(decoded.id, { $unset: { refreshToken: 1 } });
      }
    }

    const isProd = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', 'none', {
      expires: new Date(Date.now() + 10 * 1000),
      httpOnly: true,
      secure: isProd,
      sameSite: isProd ? 'none' : 'lax',
    });

    res.status(200).json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Refresh Token
// @route   POST /api/auth/refresh-token
// @access  Public
export const refreshToken = async (req, res, next) => {
  try {
    const token = req.cookies.refreshToken || req.body.refreshToken;

    if (!token) {
      return res.status(401).json({ success: false, message: 'Refresh token is missing' });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Refresh token is expired or invalid' });
    }

    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      return res.status(401).json({ success: false, message: 'Invalid refresh token mapping' });
    }

    // Send new token response
    await sendTokenResponse(user, 200, res);
  } catch (error) {
    next(error);
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
export const getMe = async (req, res, next) => {
  try {
    const userId = req.user._id || req.user.id;
    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    res.status(200).json({
      success: true,
      user,
    });
  } catch (error) {
    next(error);
  }
};

import CompanySettings from '../models/CompanySettings.js';
import { sendEmail } from '../utils/sendEmail.js';

// @desc    Forgot Password - Generate and Send OTP via SMTP
// @route   POST /api/auth/forgot-password
// @access  Public
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ success: false, message: 'Please provide a registered email address.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(404).json({ success: false, message: 'This account does not exist.' });
    }

    // Check 60-second resend cooldown
    if (user.otpLastSentAt) {
      const secondsSinceLastSent = Math.floor((Date.now() - new Date(user.otpLastSentAt).getTime()) / 1000);
      if (secondsSinceLastSent < 60) {
        const remaining = 60 - secondsSinceLastSent;
        return res.status(429).json({
          success: false,
          message: `Please wait ${remaining} seconds before requesting a new verification code.`,
        });
      }
    }

    // Check maximum resend attempts (5)
    if (user.otpResends >= 5 && user.otpExpires && new Date(user.otpExpires).getTime() > Date.now()) {
      return res.status(429).json({
        success: false,
        message: 'Maximum resend attempts reached. Please try again after 10 minutes.',
      });
    }

    // Generate secure 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Set OTP fields
    user.otpCode = otp;
    user.otpExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiration
    user.otpAttempts = 0;
    user.otpResends = (user.otpResends || 0) + 1;
    user.otpLastSentAt = new Date();
    user.resetPasswordVerified = false;

    await user.save();

    // Fetch company name for template
    const company = await CompanySettings.findOne();
    const companyName = company?.companyName || 'Work Portal';

    const subject = 'Password Reset Verification Code';
    const textBody = `Hello ${user.fullName || 'User'},\n\nYou requested to reset your password.\n\nYour verification code is:\n\n${otp}\n\nThis code is valid for 10 minutes.\n\nIf you did not request this, please ignore this email.\n\nRegards,\n${companyName}`;
    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset Verification Code</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f1f5f9;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #131b2e; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                    <span style="color: #a855f7;">WODWES</span> <span style="font-size: 13px; font-weight: 600; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">LLC</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="border-top: 1px solid rgba(255, 255, 255, 0.08);"></div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; line-height: 1.25;">
                Password Reset Verification
              </h1>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                Hello ${user.fullName || 'User'},
              </p>

              <p style="margin: 0 0 24px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                You requested to reset your account password. Please use the verification code below:
              </p>

              <!-- OTP Code Display Card -->
              <div style="margin: 0 0 28px 0; background-color: #1a233a; border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 14px; padding: 24px; text-align: center;">
                <span style="font-size: 36px; font-weight: 800; letter-spacing: 10px; color: #c084fc; font-family: monospace;">${otp}</span>
                <p style="margin: 10px 0 0 0; font-size: 13px; color: #94a3b8; font-weight: 500;">Valid for 10 minutes</p>
              </div>

              <!-- Security Notice -->
              <div style="margin: 0; background-color: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.2); border-radius: 12px; padding: 16px 20px;">
                <p style="margin: 0; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                  If you did not request a password reset, please ignore this email or contact support.
                </p>
              </div>
            </td>
          </tr>

          <!-- Subtle Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="border-top: 1px solid rgba(255, 255, 255, 0.08);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 28px 36px; text-align: left;">
              <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500;">
                © 2026 WODWES LLC. All Rights Reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;


    // Dispatch email using configured Administrator SMTP settings
    await sendEmail({
      to: user.email,
      subject,
      text: textBody,
      html: htmlBody,
    });

    res.status(200).json({
      success: true,
      message: 'Verification code sent to your email address.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Verify 6-Digit OTP Code
// @route   POST /api/auth/verify-otp
// @access  Public
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ success: false, message: 'Please provide email and verification code.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(404).json({ success: false, message: 'This account does not exist.' });
    }

    // Check attempts limit (max 5)
    if (user.otpAttempts >= 5) {
      return res.status(429).json({
        success: false,
        message: 'Too many failed verification attempts. Please request a new verification code.',
      });
    }

    // Check expiration
    if (!user.otpExpires || new Date(user.otpExpires).getTime() < Date.now()) {
      return res.status(400).json({
        success: false,
        message: 'Verification code has expired. Please request a new one.',
      });
    }

    // Check OTP match
    if (user.otpCode !== otp.toString().trim()) {
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();
      return res.status(400).json({ success: false, message: 'Invalid verification code.' });
    }

    // OTP Validated successfully
    user.resetPasswordVerified = true;
    user.otpAttempts = 0;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Verification successful. Please create your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Reset Password with New Password & Send Confirmation Email
// @route   POST /api/auth/reset-password
// @access  Public
export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide email and new password.' });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'This account does not exist.' });
    }

    // Check if OTP was verified
    if (!user.resetPasswordVerified && user.otpCode !== otp) {
      return res.status(400).json({
        success: false,
        message: 'Unauthorized password reset attempt. Please verify OTP first.',
      });
    }

    // Password Complexity Rules:
    // Minimum 8 characters, at least 1 uppercase, 1 lowercase, 1 number, 1 special character
    if (newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'Password must be at least 8 characters long.' });
    }
    if (!/[A-Z]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one uppercase letter.' });
    }
    if (!/[a-z]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one lowercase letter.' });
    }
    if (!/[0-9]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one number.' });
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(newPassword)) {
      return res.status(400).json({ success: false, message: 'Password must contain at least one special character.' });
    }

    // Update password (pre-save hook hashes with bcrypt)
    user.password = newPassword;
    user.otpCode = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
    user.otpResends = 0;
    user.resetPasswordVerified = false;
    user.refreshToken = undefined;
    user.lastPasswordChange = new Date();

    await user.save();

    // Fetch company name for template
    const company = await CompanySettings.findOne();
    const companyName = company?.companyName || 'Work Portal';

    const subject = 'Password Changed Successfully';
    const textBody = `Hello ${user.fullName || 'User'},\n\nYour password has been changed successfully.\n\nIf you did not perform this action, please contact your Administrator immediately.\n\nRegards,\n${companyName}`;
    const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Changed Successfully</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f1f5f9;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #131b2e; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                    <span style="color: #a855f7;">WODWES</span> <span style="font-size: 13px; font-weight: 600; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">LLC</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="border-top: 1px solid rgba(255, 255, 255, 0.08);"></div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; line-height: 1.25;">
                Password Changed Successfully
              </h1>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                Hello ${user.fullName || 'User'},
              </p>

              <p style="margin: 0 0 20px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                Your account password has been updated successfully.
              </p>

              <!-- Purple Alert Card -->
              <div style="margin: 0 0 28px 0; background-color: rgba(168, 85, 247, 0.12); border: 1px solid rgba(168, 85, 247, 0.3); border-radius: 12px; padding: 16px 20px;">
                <p style="margin: 0; font-size: 14px; font-weight: 600; color: #c084fc; line-height: 1.4;">
                  ✅ Account password updated securely.
                </p>
              </div>

              <!-- Security Notice -->
              <div style="margin: 0; background-color: #1a233a; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 16px 20px;">
                <p style="margin: 0; font-size: 13px; color: #cbd5e1; line-height: 1.5;">
                  If you did not perform this change, please contact your Administrator immediately.
                </p>
              </div>
            </td>
          </tr>

          <!-- Subtle Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="border-top: 1px solid rgba(255, 255, 255, 0.08);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 28px 36px; text-align: left;">
              <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500;">
                © 2026 WODWES LLC. All Rights Reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;

    // Dispatch Confirmation Email using configured Administrator SMTP
    try {
      await sendEmail({
        to: user.email,
        subject,
        text: textBody,
        html: htmlBody,
      });
    } catch (mailErr) {
      console.error('Confirmation email send error:', mailErr.message);
    }

    res.status(200).json({
      success: true,
      message: 'Password updated successfully. Please log in with your new password.',
    });
  } catch (error) {
    next(error);
  }
};

// Helper: Send verification email to new address
export const sendVerificationEmail = async ({ user, pendingEmail, token }) => {
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const verifyUrl = `${clientUrl}/verify-email?token=${token}`;
  const company = await CompanySettings.findOne();
  const companyName = company?.companyName || 'WODWES LLC';

  const subject = 'Verify your new email address';
  const textBody = `Hello ${user.fullName || 'User'},\n\nYou requested to change your account email address to ${pendingEmail}.\n\nPlease verify your new email address by visiting the link below:\n\n${verifyUrl}\n\nThis link will expire in 24 hours. Your current email remains active until verified.\n\nRegards,\n${companyName}`;

  const htmlBody = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verify Your New Email Address</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #f1f5f9;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color: #090d16; padding: 40px 16px;">
    <tr>
      <td align="center">
        <!-- Container Card -->
        <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width: 600px; background-color: #131b2e; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5);">
          
          <!-- Brand Header -->
          <tr>
            <td style="padding: 36px 36px 20px 36px; text-align: left;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="font-size: 20px; font-weight: 800; color: #ffffff; letter-spacing: -0.02em;">
                    <span style="color: #a855f7;">WODWES</span> <span style="font-size: 13px; font-weight: 600; color: #94a3b8; letter-spacing: 1px; text-transform: uppercase;">LLC</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="border-top: 1px solid rgba(255, 255, 255, 0.08);"></div>
            </td>
          </tr>

          <!-- Body Content -->
          <tr>
            <td style="padding: 32px 36px;">
              <h1 style="margin: 0 0 16px 0; font-size: 24px; font-weight: 800; color: #ffffff; letter-spacing: -0.025em; line-height: 1.25;">
                Verify Your New Email Address
              </h1>
              
              <p style="margin: 0 0 20px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                Hello ${user.fullName || 'User'},
              </p>

              <p style="margin: 0 0 24px 0; font-size: 15px; color: #cbd5e1; line-height: 1.6;">
                You requested to update your email address to <strong style="color: #ffffff;">${pendingEmail}</strong>.
              </p>

              <!-- Purple CTA Button -->
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin: 0 0 28px 0;">
                <tr>
                  <td align="center" style="border-radius: 12px; background-color: #7c3aed;">
                    <a href="${verifyUrl}" target="_blank" style="font-size: 15px; font-weight: 700; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; display: inline-block; background-color: #7c3aed; border: 1px solid #8b5cf6;">
                      Verify Email Address &rarr;
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Link Fallback Card -->
              <div style="margin: 0; background-color: #1a233a; border: 1px solid rgba(255, 255, 255, 0.06); border-radius: 12px; padding: 16px 20px;">
                <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8; font-weight: 500;">
                  Or copy and paste this link into your browser:
                </p>
                <p style="margin: 0; font-size: 12px; color: #c084fc; word-break: break-all; font-family: monospace;">
                  ${verifyUrl}
                </p>
              </div>
            </td>
          </tr>

          <!-- Subtle Divider -->
          <tr>
            <td style="padding: 0 36px;">
              <div style="border-top: 1px solid rgba(255, 255, 255, 0.08);"></div>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 24px 36px 28px 36px; text-align: left;">
              <p style="margin: 0; font-size: 12px; color: #64748b; font-weight: 500;">
                © 2026 WODWES LLC. All Rights Reserved.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `;


  await sendEmail({
    to: pendingEmail,
    subject,
    text: textBody,
    html: htmlBody,
  });
};

// @desc    Verify Email Address using token
// @route   POST /api/auth/verify-email
// @access  Public
export const verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Verification token is required.',
      });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      emailVerificationToken: hashedToken,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token.',
      });
    }

    if (!user.pendingEmail) {
      return res.status(400).json({
        success: false,
        message: 'No pending email change found for this account.',
      });
    }

    const newEmail = user.pendingEmail.toLowerCase().trim();

    // Check if new email was taken by another user while pending
    const emailExists = await User.findOne({
      email: newEmail,
      _id: { $ne: user._id },
    });

    if (emailExists) {
      return res.status(400).json({
        success: false,
        message: 'This email address is already in use by another account.',
      });
    }

    // Update email and reset pending fields
    user.email = newEmail;
    user.pendingEmail = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    user.emailVerified = true;

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Email address updated and verified successfully!',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Resend Email Verification link to pending email
// @route   POST /api/auth/resend-verification
// @access  Private
export const resendEmailVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user || !user.pendingEmail) {
      return res.status(400).json({
        success: false,
        message: 'No pending email change request found.',
      });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await user.save();

    await sendVerificationEmail({
      user,
      pendingEmail: user.pendingEmail,
      token,
    });

    res.status(200).json({
      success: true,
      message: `Verification email resent to ${user.pendingEmail}`,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Cancel Pending Email Verification
// @route   POST /api/auth/cancel-verification
// @access  Private
export const cancelEmailVerification = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    user.pendingEmail = undefined;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;

    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Pending email change cancelled',
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

