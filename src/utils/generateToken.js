import jwt from 'jsonwebtoken';
import { JWT_SECRET, JWT_REFRESH_SECRET, JWT_EXPIRE, JWT_REFRESH_EXPIRE } from '../config/env.js';

export const generateAccessToken = (userId, role) => {
  return jwt.sign({ id: userId, role }, JWT_SECRET, {
    expiresIn: JWT_EXPIRE,
  });
};

export const generateRefreshToken = (userId) => {
  return jwt.sign({ id: userId }, JWT_REFRESH_SECRET, {
    expiresIn: JWT_REFRESH_EXPIRE,
  });
};

export const sendTokenResponse = async (user, statusCode, res) => {
  try {
    // Generate tokens
    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    // Save refresh token to user document without triggering schema validation
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    // Determine cookie expire time (7 days matches default JWT_REFRESH_EXPIRE)
    const isProduction = process.env.NODE_ENV === 'production';
    const options = {
      expires: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
    };

    res
      .status(statusCode)
      .cookie('refreshToken', refreshToken, options)
      .json({
        success: true,
        accessToken,
        user: {
          id: user._id,
          fullName: user.fullName,
          email: user.email,
          phone: user.phone,
          role: user.role,
          profileImage: user.profileImage,
          status: user.status,
        },
      });
  } catch (err) {
    console.error('[sendTokenResponse FATAL ERROR]', err);
    throw err;
  }
};

