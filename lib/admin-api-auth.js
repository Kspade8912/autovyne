const { hasAdminSession } = require('./admin-auth');

function getBearerToken(req) {
  const auth = req.headers.authorization || req.headers.Authorization || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : '';
}

function hasAdminApiAccess(req) {
  if (!process.env.ADMIN_API_KEY) return false;
  if (hasAdminSession(req)) return true;
  return getBearerToken(req) === process.env.ADMIN_API_KEY;
}

function requireAdminApiAccess(req, res, next) {
  if (!process.env.ADMIN_API_KEY) return res.status(403).json({ error: 'Forbidden' });
  if (!hasAdminApiAccess(req)) return res.status(401).json({ error: 'Unauthorized' });
  return next();
}

module.exports = { getBearerToken, hasAdminApiAccess, requireAdminApiAccess };
