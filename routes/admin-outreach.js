const { Router } = require('express');
const { hasAdminSession } = require('../lib/admin-auth');
const { sanitizeString } = require('../lib/security');
const { compactIndustryProfile } = require('../lib/industry-ai-profiles');
const {
  createOutreachLead,
  listDuplicateLeadGroups,
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

function parseDelimitedLine(line) {
  const values = [];
  let current = '';
  let quoted = false;
  const delimiter = line.includes('\t') ? '\t' : ',';

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());
  return values;
}

function parseLeadImport(rawText) {
  return String(rawText || '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .filter(line => !/^business\s*name/i.test(line))
    .map(line => {
      const [businessName, industry, websiteUrl, email, phone, contactName, note] = parseDelimitedLine(line);
      return {
        businessName,
        industry,
        websiteUrl,
        email,
        phone,
        contactName,
        personalizationNote: note,
      };
    })
    .filter(row => row.businessName);
}

function csvCell(value) {
  const text = String(value ?? '');
  return `"${text.replace(/"/g, '""')}"`;
}

function leadsToCsv(leads) {
  const headers = [
    'id',
    'business_name',
    'industry',
    'contact_name',
    'email',
    'phone',
    'website_url',
    'stage',
    'priority',
    'do_not_contact',
    'last_contacted_at',
    'next_action_at',
    'personalization_note',
    'outreach_notes',
  ];
  const rows = leads.map(lead => headers.map(header => csvCell(lead[header])).join(','));
  return [headers.join(','), ...rows].join('\n');
}

async function pageData(req, overrides = {}) {
  const activeStage = sanitizeString(req.query.stage || 'all') || 'all';
  const [leads, allLeads, duplicateGroups] = await Promise.all([
    listOutreachLeads({ stage: activeStage, limit: 250 }),
    activeStage === 'all' ? Promise.resolve(null) : listOutreachLeads({ stage: 'all', limit: 250 }),
    listDuplicateLeadGroups({ limit: 10 }),
  ]);
  const allLeadRows = allLeads || leads;

  return {
    activeStage,
    error: null,
    success: req.query.imported
      ? `Imported ${req.query.imported} lead${req.query.imported === '1' ? '' : 's'}; skipped ${req.query.skipped || 0} duplicate${req.query.skipped === '1' ? '' : 's'}.`
      : null,
    leads,
    allLeads: allLeadRows,
    duplicateGroups,
    stats: outreachStats(allLeadRows),
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

router.get('/export.csv', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('Forbidden');
  if (!hasAdminSession(req)) return res.status(401).send('Admin login required');

  try {
    const stage = sanitizeString(req.query.stage || 'all') || 'all';
    const leads = await listOutreachLeads({ stage, limit: 1000 });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="autovyne-outreach-${stage}.csv"`);
    res.send(leadsToCsv(leads));
  } catch (error) {
    console.error('[admin-outreach] export error:', error.message);
    res.status(500).send('Export failed');
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

router.post('/import', async (req, res) => {
  if (!process.env.ADMIN_API_KEY) return res.status(403).send('<h1>Forbidden</h1>');
  if (!hasAdminSession(req)) return res.status(401).redirect('/admin');

  try {
    const rows = parseLeadImport(req.body.leads_csv);
    if (!rows.length) {
      return res.status(400).render('admin-outreach', await pageData(req, {
        error: 'Paste at least one lead row before importing.',
      }));
    }

    let imported = 0;
    let skipped = 0;
    for (const row of rows.slice(0, 100)) {
      const lead = await createOutreachLead({
        ...row,
        source: 'manual_outreach_import',
        priority: sanitizeString(req.body.default_priority) || 'medium',
        outreachNotes: 'Imported from Outreach Board for human-reviewed cold-call prep.',
      });
      if (lead.duplicateSkipped) skipped += 1;
      else imported += 1;
    }

    res.redirect(`/admin/outreach?stage=researched&imported=${imported}&skipped=${skipped}`);
  } catch (error) {
    console.error('[admin-outreach] import error:', error.message);
    res.status(500).render('admin-outreach', await pageData(req, { error: 'Lead import failed.' }));
  }
});

module.exports = router;
