const { Router } = require('express');
const { clearAdminSession, hasAdminSession, setAdminSession, verifyAdminLogin } = require('../lib/admin-auth');

const router = Router();

function renderAdmin(res, { authorized = false, error = null } = {}) {
  res.render('admin', { authorized, error });
}

router.get('/', (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  renderAdmin(res, { authorized: hasAdminSession(req) });
});

router.post('/login', (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!verifyAdminLogin(req.body)) {
    return res.status(401).render('admin', { authorized: false, error: 'Invalid username or password' });
  }

  setAdminSession(res);
  res.redirect('/admin');
});

router.post('/logout', (_req, res) => {
  clearAdminSession(res);
  res.redirect('/admin');
});

module.exports = router;
