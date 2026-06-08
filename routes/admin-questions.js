const { Router } = require('express');
const { hasAdminSession } = require('../lib/admin-auth');
const { sanitizeString } = require('../lib/security');
const { listQuestions, updateQuestionStatus } = require('../db/questions');

const router = Router();

function isAuthorized(req) {
  return hasAdminSession(req);
}

function normalizeFilters(query = {}) {
  return {
    status: sanitizeString(query.status || 'all') || 'all',
    category: sanitizeString(query.category || 'all') || 'all',
  };
}

async function pageData(overrides = {}) {
  const filters = overrides.filters || normalizeFilters();
  const questions = await listQuestions(filters);
  const openCount = questions.filter(q => ['new', 'reviewing'].includes(q.status)).length;
  const urgentCount = questions.filter(q => q.urgency === 'urgent' && q.status !== 'closed').length;
  return {
    authorized: true,
    error: null,
    success: null,
    filters,
    questions,
    openCount,
    urgentCount,
    ...overrides,
  };
}

router.get('/', async (req, res) => {
  if (!isAuthorized(req)) return res.redirect('/admin');

  try {
    res.render('admin-questions', await pageData({ filters: normalizeFilters(req.query) }));
  } catch (error) {
    console.error('[admin-questions] load error:', error.message);
    res.status(500).render('admin-questions', await pageData({ error: 'Question queue could not be loaded.' }));
  }
});

router.post('/:id', async (req, res) => {
  if (!isAuthorized(req)) return res.redirect('/admin');

  try {
    const question = await updateQuestionStatus({
      id: parseInt(req.params.id, 10),
      status: sanitizeString(req.body.status),
      ownerNote: sanitizeString(req.body.owner_note),
      adminReply: sanitizeString(req.body.admin_reply),
    });

    if (!question) {
      return res.status(404).render('admin-questions', await pageData({ error: 'Question not found.' }));
    }

    res.render('admin-questions', await pageData({ success: `Updated question from ${question.name}.` }));
  } catch (error) {
    console.error('[admin-questions] update error:', error.message);
    res.status(500).render('admin-questions', await pageData({ error: 'Question could not be updated.' }));
  }
});

module.exports = router;
