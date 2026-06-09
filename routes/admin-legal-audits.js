const { Router } = require('express');
const { getAdminSnapshot, recordAccountEvent } = require('../db/accounts');
const {
  getLegalAuditReviewById,
  listLegalAuditReviews,
  updateLegalAuditReviewStatus,
} = require('../db/legal-audits');
const { hasAdminSession } = require('../lib/admin-auth');
const { LEGAL_AUDIT_STATUS, normalizeAuditStatus } = require('../lib/legal-audit-rules');
const { sanitizeString } = require('../lib/security');
const { askLegalAuditAssistant } = require('../services/openai');
const { runLegalAuditCycle } = require('../services/legal-audit-runner');

const router = Router();

function isAuthorized(req) {
  return hasAdminSession(req) || Boolean(process.env.ADMIN_API_KEY && req.signedCookies?.accounts_auth === 'authorized');
}

async function pageData(overrides = {}) {
  const status = sanitizeString(overrides.status || overrides.query?.status || 'needs_admin_review') || 'needs_admin_review';
  const audits = await listLegalAuditReviews({ status, limit: 150 });
  const allRecent = await listLegalAuditReviews({ status: 'all', limit: 150 });
  return {
    authorized: true,
    error: null,
    success: null,
    status,
    statuses: LEGAL_AUDIT_STATUS,
    audits,
    counts: {
      needs_admin_review: allRecent.filter(a => a.status === 'needs_admin_review').length,
      approved: allRecent.filter(a => a.status === 'approved').length,
      resolved: allRecent.filter(a => a.status === 'resolved').length,
      dismissed: allRecent.filter(a => a.status === 'dismissed').length,
      all: allRecent.length,
    },
    assistantQuestion: '',
    assistantResponse: null,
    ...overrides,
  };
}

function fallbackPageData(overrides = {}) {
  return {
    authorized: true,
    error: null,
    success: null,
    status: 'needs_admin_review',
    statuses: LEGAL_AUDIT_STATUS,
    audits: [],
    counts: {
      needs_admin_review: 0,
      approved: 0,
      resolved: 0,
      dismissed: 0,
      all: 0,
    },
    assistantQuestion: '',
    assistantResponse: null,
    ...overrides,
  };
}

router.get('/', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin');
  try {
    res.render('admin-legal-audits', await pageData({ query: req.query }));
  } catch (error) {
    console.error('[admin-legal-audits] load error:', error.message);
    res.status(500).render('admin-legal-audits', fallbackPageData({ error: 'Legal audits could not be loaded.' }));
  }
});

router.post('/run', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin');
  try {
    const audits = await runLegalAuditCycle({ limit: 75 });
    res.render('admin-legal-audits', await pageData({
      success: `Legal Audit AI checked recent customer requests and prepared ${audits.length} audit record(s).`,
      query: req.query,
    }));
  } catch (error) {
    console.error('[admin-legal-audits] run error:', error.message);
    res.status(500).render('admin-legal-audits', fallbackPageData({ error: 'Legal Audit AI could not run right now.' }));
  }
});

router.post('/assistant', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin');
  const assistantQuestion = sanitizeString(req.body.assistant_question);
  try {
    const [audits, snapshot] = await Promise.all([
      listLegalAuditReviews({ status: 'all', limit: 100 }),
      getAdminSnapshot(),
    ]);
    const assistantResponse = await askLegalAuditAssistant({ question: assistantQuestion, audits, snapshot });
    res.render('admin-legal-audits', await pageData({ assistantQuestion, assistantResponse }));
  } catch (error) {
    console.error('[admin-legal-audits] assistant error:', error.message);
    res.status(500).render('admin-legal-audits', fallbackPageData({
      assistantQuestion,
      assistantResponse: 'Legal Audit AI could not answer right now. Review the queue manually and try again.',
    }));
  }
});

router.post('/assistant.json', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).json({ error: 'Admin login required.' });
  const question = sanitizeString(req.body.question || req.body.assistant_question);
  try {
    const [audits, snapshot] = await Promise.all([
      listLegalAuditReviews({ status: 'all', limit: 100 }),
      getAdminSnapshot(),
    ]);
    const answer = await askLegalAuditAssistant({ question, audits, snapshot });
    res.json({ answer, level: 'legal-audit', label: 'Legal Audit AI' });
  } catch (error) {
    console.error('[admin-legal-audits] assistant json error:', error.message);
    res.status(500).json({ error: 'Legal Audit AI could not answer right now.' });
  }
});

router.post('/:id/status', async (req, res) => {
  if (!isAuthorized(req)) return res.status(401).redirect('/admin');
  try {
    const audit = await getLegalAuditReviewById(parseInt(req.params.id, 10));
    if (!audit) return res.status(404).render('admin-legal-audits', await pageData({ error: 'Audit not found.' }));

    const updated = await updateLegalAuditReviewStatus({
      id: audit.id,
      status: normalizeAuditStatus(req.body.status),
      resolutionNote: sanitizeString(req.body.resolution_note),
      approvedBy: 'Autovyne admin',
    });

    if (updated?.account_id) {
      await recordAccountEvent({
        accountId: updated.account_id,
        eventType: 'legal_audit_review',
        title: `Legal audit ${String(updated.status).replace(/_/g, ' ')}`,
        detail: updated.resolution_note || 'Autovyne reviewed a compliance-sensitive account item.',
        visibleToClient: false,
      });
    }

    res.redirect('/admin/legal-audits');
  } catch (error) {
    console.error('[admin-legal-audits] status error:', error.message);
    res.status(500).render('admin-legal-audits', fallbackPageData({ error: 'Audit status could not be updated.' }));
  }
});

module.exports = router;
