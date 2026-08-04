import Activity from '../models/Activity.js';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: parse a basic user-agent string into human-readable browser / OS / device
// ─────────────────────────────────────────────────────────────────────────────
const parseUserAgent = (ua = '') => {
  let browser = 'Unknown Browser';
  let operatingSystem = 'Unknown OS';
  let device = 'Desktop';

  // Browser
  if (/Edg\//.test(ua))           browser = 'Microsoft Edge';
  else if (/OPR\//.test(ua))      browser = 'Opera';
  else if (/Firefox\//.test(ua))  browser = 'Firefox';
  else if (/Chrome\//.test(ua))   browser = 'Chrome';
  else if (/Safari\//.test(ua))   browser = 'Safari';
  else if (/MSIE|Trident/.test(ua)) browser = 'Internet Explorer';

  // OS
  if (/Windows NT 11/.test(ua) || /Windows NT 10.*Win64/.test(ua)) operatingSystem = 'Windows 11';
  else if (/Windows NT 10/.test(ua)) operatingSystem = 'Windows 10';
  else if (/Windows NT/.test(ua)) operatingSystem = 'Windows';
  else if (/Mac OS X/.test(ua))   operatingSystem = 'macOS';
  else if (/Android/.test(ua))    operatingSystem = 'Android';
  else if (/iPhone|iPad/.test(ua)) operatingSystem = 'iOS';
  else if (/Linux/.test(ua))      operatingSystem = 'Linux';

  // Device
  if (/Mobi|Android|iPhone/.test(ua)) device = 'Mobile';
  else if (/iPad|Tablet/.test(ua))    device = 'Tablet';

  return { browser, operatingSystem, device };
};

// ─────────────────────────────────────────────────────────────────────────────
// Helper: extract the client's real IP address
// ─────────────────────────────────────────────────────────────────────────────
const getClientIP = (req) => {
  return (
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.socket?.remoteAddress ||
    ''
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Route-to-activity mapping table
// Each entry: { match, module, action, activityType, title, descFn }
//   match: function(method, url) -> boolean
// ─────────────────────────────────────────────────────────────────────────────
const ACTIVITY_MAP = [
  // ── Auth ──
  {
    match: (m, u) => m === 'POST' && u.includes('/auth/login'),
    module: 'auth', action: 'login', activityType: 'login',
    title: 'Login',
    descFn: () => 'You successfully logged into your account.',
  },
  {
    match: (m, u) => m === 'POST' && u.includes('/auth/logout'),
    module: 'auth', action: 'logout', activityType: 'logout',
    title: 'Logout',
    descFn: () => 'You logged out of your account.',
  },

  // ── Profile ──
  {
    match: (m, u) => m === 'PUT' && u.includes('/profile') && !u.includes('/password'),
    module: 'profile', action: 'profile_updated', activityType: 'profile_updated',
    title: 'Profile Updated',
    descFn: () => 'Your profile information was updated.',
  },
  {
    match: (m, u) => m === 'PUT' && u.includes('/profile/password'),
    module: 'profile', action: 'password_changed', activityType: 'password_changed',
    title: 'Password Changed',
    descFn: () => 'Your account password was changed.',
  },

  // ── Requests ──
  {
    match: (m, u) => m === 'POST' && u.includes('/requests'),
    module: 'requests', action: 'request_created', activityType: 'request_created',
    title: 'Request Submitted',
    descFn: (body) => `A new request was submitted${body?.title ? `: "${body.title}"` : ''}.`,
  },

  // ── Projects ──
  {
    match: (m, u) => m === 'POST' && u.includes('/projects'),
    module: 'projects', action: 'project_created', activityType: 'project_created',
    title: 'Project Created',
    descFn: (body) => `A new project was created${body?.projectName ? `: "${body.projectName}"` : ''}.`,
  },
  {
    match: (m, u) => (m === 'PUT' || m === 'PATCH') && u.includes('/projects'),
    module: 'projects', action: 'project_updated', activityType: 'project_updated',
    title: 'Project Updated',
    descFn: () => 'A project was updated.',
  },

  // ── Files ──
  {
    match: (m, u) => m === 'POST' && (u.includes('/files') || u.includes('submit-review') || u.includes('/requests')),
    module: 'files', action: 'file_uploaded', activityType: 'file_uploaded',
    title: 'File Uploaded',
    descFn: () => 'A file was uploaded to the system.',
  },

  // ── Notifications ──
  {
    match: (m, u) => (m === 'PATCH' || m === 'PUT') && u.includes('/notifications'),
    module: 'notifications', action: 'notification_read', activityType: 'notification_read',
    title: 'Notification Read',
    descFn: () => 'A notification was marked as read.',
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Middleware factory
// Usage: app.use(activityLoggerMiddleware)  — after routes that set req.user
// ─────────────────────────────────────────────────────────────────────────────
export const activityLoggerMiddleware = (req, res, next) => {
  // Intercept res.json to inspect the response after it leaves the controller
  const originalJson = res.json.bind(res);

  res.json = function (body) {
    // Only log if the request was successful (2xx) and a user is authenticated
    if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
      const method  = req.method.toUpperCase();
      const url     = req.originalUrl || req.url || '';

      // Find matching activity rule
      const rule = ACTIVITY_MAP.find((r) => r.match(method, url));

      if (rule) {
        const { browser, operatingSystem, device } = parseUserAgent(req.headers['user-agent']);
        const ipAddress = getClientIP(req);

        // Fire-and-forget — don't block the response
        Activity.create({
          user_id:         req.user._id,
          shop_id:         req.user._id,  // Mapped to user in single-tenant model
          module:          rule.module,
          action:          rule.action,
          activityType:    rule.activityType,
          title:           rule.title,
          description:     rule.descFn(req.body),
          metadata:        { method, url, requestBody: req.body },
          ipAddress,
          browser,
          operatingSystem,
          device,
          status:          'success',
        }).catch((err) => {
          console.error('[ActivityLogger] Failed to save activity:', err.message);
        });
      }
    }

    return originalJson(body);
  };

  next();
};
