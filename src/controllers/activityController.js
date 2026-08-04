import Activity from '../models/Activity.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: build a date range object { $gte, $lte } for a named period
// ─────────────────────────────────────────────────────────────────────────────
const buildDateRange = (period, startDate, endDate) => {
  const now = new Date();

  const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const endOf   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

  switch (period) {
    case 'today':
      return { $gte: startOf(now), $lte: endOf(now) };
    case 'yesterday': {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      return { $gte: startOf(yesterday), $lte: endOf(yesterday) };
    }
    case 'weekly': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return { $gte: startOf(weekAgo), $lte: endOf(now) };
    }
    case 'monthly': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { $gte: monthStart, $lte: endOf(now) };
    }
    case 'yearly': {
      const yearStart = new Date(now.getFullYear(), 0, 1);
      return { $gte: yearStart, $lte: endOf(now) };
    }
    case 'custom':
      if (startDate && endDate) {
        return { $gte: new Date(startDate), $lte: new Date(endDate) };
      }
      return null;
    default:
      return null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc  Get paginated, filtered activities for the logged-in client
// @route GET /api/client/activity
// @access Private/Client
// ─────────────────────────────────────────────────────────────────────────────
export const getClientActivities = async (req, res, next) => {
  try {
    const {
      search, activityType, period, startDate, endDate,
      page = 1, limit = 20,
    } = req.query;

    const query = { user_id: req.user._id };

    // Search by title or description
    if (search && search.trim()) {
      const cleanSearch = search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      query.$or = [
        { title:       { $regex: cleanSearch, $options: 'i' } },
        { description: { $regex: cleanSearch, $options: 'i' } },
        { action:      { $regex: cleanSearch, $options: 'i' } },
      ];
    }

    // Activity type filter
    if (activityType) query.activityType = activityType;

    // Date range filter
    const dateRange = buildDateRange(period, startDate, endDate);
    if (dateRange) query.createdAt = dateRange;

    const pageNum  = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit)));
    const skip     = (pageNum - 1) * limitNum;

    const [total, activities] = await Promise.all([
      Activity.countDocuments(query),
      Activity.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
    ]);

    res.status(200).json({
      success: true,
      count: activities.length,
      pagination: {
        total,
        page: pageNum,
        pages: Math.ceil(total / limitNum),
        limit: limitNum,
      },
      activities,
    });
  } catch (error) {
    next(error);
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @desc  Get summary stats for the summary cards
// @route GET /api/client/activity/stats
// @access Private/Client
// ─────────────────────────────────────────────────────────────────────────────
export const getActivityStats = async (req, res, next) => {
  try {
    const userId = req.user._id;
    const now    = new Date();

    const startOf = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
    const endOf   = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const [today, yesterdayCount, weekly, monthly, yearly] = await Promise.all([
      Activity.countDocuments({ user_id: userId, createdAt: { $gte: startOf(now),      $lte: endOf(now)  } }),
      Activity.countDocuments({ user_id: userId, createdAt: { $gte: startOf(yesterday), $lte: endOf(yesterday) } }),
      Activity.countDocuments({ user_id: userId, createdAt: { $gte: startOf(weekAgo),   $lte: endOf(now)  } }),
      Activity.countDocuments({ user_id: userId, createdAt: { $gte: new Date(now.getFullYear(), now.getMonth(), 1), $lte: endOf(now) } }),
      Activity.countDocuments({ user_id: userId, createdAt: { $gte: new Date(now.getFullYear(), 0, 1), $lte: endOf(now) } }),
    ]);

    res.status(200).json({
      success: true,
      stats: { today, yesterday: yesterdayCount, weekly, monthly, yearly },
    });
  } catch (error) {
    next(error);
  }
};
