function hasAdminSession(req) {
  return Boolean(process.env.ADMIN_API_KEY && req.signedCookies?.admin_auth === 'authorized');
}

function verifyAdminLogin({ username, password, key }) {
  if (!process.env.ADMIN_API_KEY) return false;

  const configuredUsername = process.env.ADMIN_USERNAME;
  const configuredPassword = process.env.ADMIN_PASSWORD;
  if (configuredUsername && configuredPassword) {
    return username === configuredUsername && password === configuredPassword;
  }

  return key === process.env.ADMIN_API_KEY;
}

function setAdminSession(res) {
  res.cookie('admin_auth', 'authorized', {
    httpOnly: true,
    signed: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
}

function clearAdminSession(res) {
  res.clearCookie('admin_auth');
  res.clearCookie('accounts_auth');
  res.clearCookie('analytics_auth');
  res.clearCookie('compliance_auth');
}

module.exports = { clearAdminSession, hasAdminSession, setAdminSession, verifyAdminLogin };
