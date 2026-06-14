const assert = require('assert');
const { fetchJsonWithRetry, isRetryableError } = require('./lib/http');
const { buildDailyMonitoringRows, buildWorkflowRehearsal } = require('./lib/workflow-rehearsal');

(async () => {
  const previousIdentity = {
    COMPANY_ENTITY_NAME: process.env.COMPANY_ENTITY_NAME,
    BUSINESS_ADDRESS: process.env.BUSINESS_ADDRESS,
    SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  };
  delete process.env.COMPANY_ENTITY_NAME;
  delete process.env.BUSINESS_ADDRESS;
  delete process.env.SUPPORT_EMAIL;

  const rehearsal = buildWorkflowRehearsal({
    integrations: {
      supabase: { configured: true },
      openai: { configured: true, model: 'gpt-test' },
      hubspot: { configured: true },
      n8n: { configured: true },
    },
    accounts: [{
      business_name: 'Autovyne Demo HVAC',
      email: 'demo@autovyne.com',
      status: 'active',
      services: {
        ai_calling: true,
        sms_followup: true,
        crm_sync: true,
        n8n_workflows: true,
        openai_qualification: true,
      },
    }],
    snapshot: {
      questions: [],
      clientRequests: [],
      legalAudits: [{ status: 'needs_admin_review' }],
      consents: [{ consented: true }],
    },
    incidents: [],
    dbReachable: true,
  });

  assert.equal(rehearsal.totalCount, 9);
  assert.equal(rehearsal.rows.find(row => row.title.includes('Demo account')).status, 'done');
  assert.equal(rehearsal.rows.find(row => row.area === 'Business Details').status, 'manual');
  assert(rehearsal.score >= 75);

  const monitoring = buildDailyMonitoringRows({
    snapshot: {
      questions: [{ status: 'new' }],
      clientRequests: [],
      legalAudits: [],
      consents: [{ consented: true }],
    },
    incidents: [{ id: 1 }],
    accounts: [{ status: 'setup' }],
  });
  assert.equal(monitoring.length, 5);
  assert.equal(monitoring.filter(row => row.status === 'review').length, 3);

  assert.equal(isRetryableError(new Error('HTTP 429: capacity')), true);
  assert.equal(isRetryableError(new Error('HTTP 400: bad request')), false);

  let attempts = 0;
  const originalFetch = global.fetch;
  global.fetch = async () => {
    attempts += 1;
    if (attempts === 1) {
      return {
        ok: false,
        status: 429,
        text: async () => JSON.stringify({ error: { message: 'capacity' } }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ ok: true }),
    };
  };

  const result = await fetchJsonWithRetry('https://example.test/retry', {}, 1000, { retries: 1, baseDelayMs: 1 });
  assert.deepEqual(result, { ok: true });
  assert.equal(attempts, 2);
  global.fetch = originalFetch;

  Object.entries(previousIdentity).forEach(([key, value]) => {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  });

  console.log('Workflow rehearsal and retry smoke test passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
