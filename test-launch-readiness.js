const assert = require('assert');
const { buildManualLaunchTasks } = require('./lib/manual-launch-tasks');
const { buildOnboardingChecklist } = require('./lib/onboarding-checklist');
const { OFFER_POINTS, SCRIPT_BLOCKS, SIMPLE_SALES_FLOW } = require('./lib/sales-playbook');

const demoAccount = {
  id: 1,
  business_name: 'Autovyne Demo HVAC',
  contact_name: 'Demo Owner',
  email: 'demo@autovyne.com',
  phone: '+15555050123',
  industry: 'hvac',
  status: 'active',
  billing_method: 'automatic',
  paid_at: new Date().toISOString(),
  activated_at: new Date().toISOString(),
  services: {
    ai_calling: true,
    sms_followup: true,
    crm_sync: true,
    n8n_workflows: true,
    openai_qualification: true,
  },
};

const checklist = buildOnboardingChecklist(demoAccount);
assert.equal(checklist.totalCount, 9);
assert.ok(checklist.doneCount >= 6);
assert.ok(checklist.rows.some(row => row.title === 'Text consent and message rules' && row.status === 'review'));
assert.ok(checklist.manualCount >= 1);

const tasks = buildManualLaunchTasks({
  integrations: {
    stripe: {
      checkoutConfigured: true,
      webhookConfigured: true,
      pricesConfigured: {
        smbBundle: true,
        starter: true,
        professional: true,
        enterprise: true,
      },
    },
    openai: { configured: true },
    hubspot: { configured: true },
    n8n: { configured: true },
    twilio: { configured: false },
  },
  accounts: [demoAccount],
  snapshot: { consents: [{ consented: true }] },
});

assert.ok(tasks.some(task => task.key === 'twilio_registration' && task.status === 'blocked'));
assert.ok(tasks.some(task => task.key === 'demo_account' && task.status === 'done'));
assert.ok(tasks.some(task => task.key === 'live_checkout_rehearsal' && task.status === 'manual'));

assert.ok(SIMPLE_SALES_FLOW.length >= 5);
assert.ok(OFFER_POINTS.some(point => point.label === 'What not to promise'));
assert.ok(SCRIPT_BLOCKS.some(script => script.title === 'SMS follow-up only with consent'));

console.log('Launch readiness helper smoke test passed.');
