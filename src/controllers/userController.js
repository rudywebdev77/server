import User from '../models/User.js';

// @desc    Get all users (with search, filter, pagination) - ALWAYS EXCLUDES ADMIN
// @route   GET /api/users
// @access  Private/Admin
export const getUsers = async (req, res, next) => {
  try {
    const { role, search, status, page = 1, limit = 10 } = req.query;

    // Strict base query excluding admin accounts completely
    const query = {
      role: { $ne: 'admin' },
    };

    // Filter by allowed role ('staff' or 'client')
    if (role && (role === 'staff' || role === 'client')) {
      query.role = role;
    }

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Search query (name or email)
    if (search && search.trim()) {
      const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { fullName: { $regex: cleanSearch, $options: 'i' } },
        { email: { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 10;
    const skip = (pageNum - 1) * limitNum;

    const [total, users] = await Promise.all([
      User.countDocuments(query),
      User.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      count: users.length,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum) || 1,
      },
      users,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Get single user - EXCLUDES ADMIN
// @route   GET /api/users/:id
// @access  Private/Admin
export const getUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: { $ne: 'admin' } }).lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or Administrator account cannot be managed from User Management',
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

// @desc    Create user (Staff & Clients only)
// @route   POST /api/users
// @access  Private/Admin
export const createUser = async (req, res, next) => {
  try {
    const { fullName, email, phone, password, role, status } = req.body;

    if (role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot create Administrator accounts from User Management. Only Staff and Clients are permitted.',
      });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'User with this email already exists' });
    }

    let profileImage = '';
    if (req.file) {
      profileImage = `/uploads/${req.file.filename}`;
    }

    const user = await User.create({
      fullName,
      email,
      phone,
      password,
      role: role === 'staff' ? 'staff' : 'client',
      status: status || 'active',
      profileImage,
      createdBy: req.user._id,
    });

    res.status(201).json({
      success: true,
      message: 'User created successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Update user details - EXCLUDES ADMIN
// @route   PUT /api/users/:id
// @access  Private/Admin
export const updateUser = async (req, res, next) => {
  try {
    const { fullName, email, phone, role, status, password } = req.body;

    const user = await User.findOne({ _id: req.params.id, role: { $ne: 'admin' } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or Administrator accounts cannot be modified from User Management',
      });
    }

    if (role === 'admin') {
      return res.status(400).json({
        success: false,
        message: 'Cannot elevate account to Administrator role from User Management',
      });
    }

    // Check if email already in use by another user
    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) {
        return res.status(400).json({ success: false, message: 'Email already in use by another account' });
      }
      user.email = email;
    }

    if (fullName) user.fullName = fullName;
    if (phone !== undefined) user.phone = phone;
    if (role && (role === 'staff' || role === 'client')) user.role = role;
    if (status) user.status = status;

    if (req.file) {
      user.profileImage = `/uploads/${req.file.filename}`;
    }

    // Update password if provided
    if (password && password.trim() !== '') {
      user.password = password;
    }

    await user.save();

    res.status(200).json({
      success: true,
      message: 'User updated successfully',
      user,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Toggle user active status - EXCLUDES ADMIN
// @route   PATCH /api/users/:id/status
// @access  Private/Admin
export const toggleUserStatus = async (req, res, next) => {
  try {
    const { status } = req.body;

    if (!['active', 'inactive', 'deactivated'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status value' });
    }

    const userToToggle = await User.findOne({ _id: req.params.id, role: { $ne: 'admin' } });
    if (!userToToggle) {
      return res.status(404).json({
        success: false,
        message: 'User not found or Administrator status cannot be modified from User Management',
      });
    }

    userToToggle.status = status;
    await userToToggle.save();

    res.status(200).json({
      success: true,
      message: `User status changed to ${status}`,
      user: userToToggle,
    });
  } catch (error) {
    next(error);
  }
};

// @desc    Delete user - EXCLUDES ADMIN
// @route   DELETE /api/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.params.id, role: { $ne: 'admin' } });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found or Administrator accounts cannot be deleted from User Management',
      });
    }

    await user.deleteOne();

    res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    next(error);
  }
};
