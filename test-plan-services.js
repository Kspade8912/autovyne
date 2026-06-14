const assert = require('assert');
const {
  filterServicesForPlan,
  getPlanServiceBundle,
  serviceRowsForPlan,
} = require('./lib/plan-services');

const starter = getPlanServiceBundle('starter');
assert.equal(starter.ai_calling, true);
assert.equal(starter.sms_followup, true);
assert.equal(starter.crm_sync, true);
assert.equal(starter.openai_qualification, true);
assert.equal(starter.n8n_workflows, false);

const filteredStarter = filterServicesForPlan('starter', {
  ai_calling: true,
  sms_followup: true,
  crm_sync: true,
  n8n_workflows: true,
  openai_qualification: true,
});
assert.equal(filteredStarter.n8n_workflows, false);

['smb-bundle', 'professional', 'enterprise'].forEach(plan => {
  const services = getPlanServiceBundle(plan);
  assert.equal(Object.values(services).every(Boolean), true, `${plan} should include the full stack`);
});

const rows = serviceRowsForPlan('starter');
assert.equal(rows.length, 5);
assert.equal(rows.find(row => row.key === 'n8n_workflows').included, false);
assert.equal(rows.find(row => row.key === 'crm_sync').label, 'Lead Tracker');
assert.equal(rows.find(row => row.key === 'n8n_workflows').label, 'Booking & Follow-up Flow');

console.log('Plan service bundle smoke test passed.');
