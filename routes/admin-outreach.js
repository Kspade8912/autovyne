const { Router } = require('express');
const { hasAdminSession } = require('../lib/admin-auth');
const { sanitizeString } = require('../lib/security');
const { compactIndustryProfile } = require('../lib/industry-ai-profiles');
const {
  listOutreachLeads,
  outreachStats,
  STAGES,
  updateLeadOutreach,
} = require('../db/outreach');

const router = Router();

function stageLabel(stage) {
  return String(stage || 'new').replace(/_/g, ' ');
}

function callBrief(lead) {
  const profile = compactIndustryProfile(lead.industry);
  const loss = Number(lead.estimated_monthly_loss || 0);
  return {
    trait: profile.defining_trait,
    opener: `Quick question: how are you handling ${profile.call_opener_angle} right now?`,
    pain: lead.personalization_note ||
      `${lead.business_name} may be losing about $${loss.toLocaleString()} per month from missed-call or follow-up gaps based on the demo numbers they entered.`,
    questions: profile.discovery_questions || [],
    guardrail: profile.escalation_rule,
  };
}

async function pageData(req, overrides = {}) {
  const activeStage = sanitizeString(req.query.stage || 'all') || 'all';
  const leads = await listOutreachLeads({ stage: activeStage, limit: 250 });
  const allLeads = activeStage === 'all' ? leads : await listOutreachLeads({ stage: 'all', limit: 250 });

  return {
    activeStage,
    error: null,
    success: null,
    leads,
    allLeads,
    stats: outreachStats(allLeads),
    stages: STAGES,
    stageLabel,
    callBrief,
    ...overrides,
  };
}

router.get('/', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!hasAdminSession(req)) return res.redirect('/admin');

  try {
    res.render('admin-outreach', await pageData(req));
  } catch (error) {
    console.error('[admin-outreach] load error:', error.message);
    res.status(500).render('admin-outreach', await pageData(req, {
      error: 'Outreach board could not load right now.',
      leads: [],
      allLeads: [],
      stats: outreachStats([]),
    }));
  }
});

router.post('/leads/:id', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!hasAdminSession(req)) return res.status(401).redirect('/admin');

  try {
    const lead = await updateLeadOutreach({
      id: parseInt(req.params.id, 10),
      stage: sanitizeString(req.body.stage),
      priority: sanitizeString(req.body.priority),
      contactName: sanitizeString(req.body.contact_name),
      owner: sanitizeString(req.body.owner),
      personalizationNote: sanitizeString(req.body.personalization_note),
      outreachNotes: sanitizeString(req.body.outreach_notes),
      doNotContact: req.body.do_not_contact === 'true',
      lastContactedAt: sanitizeString(req.body.last_contacted_at),
      nextActionAt: sanitizeString(req.body.next_action_at),
    });

    if (!lead) {
      return res.status(404).render('admin-outreach', await pageData(req, { error: 'Lead not found.' }));
    }

    res.redirect(`/admin/outreach?stage=${encodeURIComponent(req.query.stage || 'all')}#lead-${lead.id}`);
  } catch (error) {
    console.error('[admin-outreach] update error:', error.message);
    res.status(500).render('admin-outreach', await pageData(req, { error: 'Lead outreach status could not be saved.' }));
  }
});

module.exports = router;
