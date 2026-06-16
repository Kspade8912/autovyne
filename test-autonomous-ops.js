const assert = require('assert');
const { buildOpsBrief } = require('./services/autonomous-ops');

const accounts = [
  {
    id: 1,
    business_name: 'Review Plumbing',
    status: 'needs_attention',
    billing_method: 'automatic',
    services: {
      ai_calling: true,
      sms_followup: false,
      crm_sync: true,
      n8n_workflows: false,
      openai_qualification: true,
    },
  },
  {
    id: 2,
    business_name: 'Active HVAC',
    status: 'active',
    billing_method: 'automatic',
    services: {
      ai_calling: true,
      sms_followup: true,
      crm_sync: true,
      n8n_workflows: true,
      openai_qualification: true,
    },
  },
];

const snapshot = {
  legalAudits: [
    {
      status: 'needs_admin_review',
      severity: 'high',
      title: 'SMS consent proof review',
      recommended_action: 'Verify consent record before sending follow-up.',
    },
  ],
  clientRequests: [
    {
      status: 'submitted',
      priority: 'urgent',
      business_name: 'Review Plumbing',
      request_type: 'block_caller',
      reason: 'Customer booked and should not receive more follow-up.',
    },
  ],
  questions: [{ status: 'new' }],
};

const brief = buildOpsBrief({
  accounts,
  snapshot,
  integrationStatus: {
    openai: { configured: true },
    hubspot: { configured: true },
    n8n: { configured: true },
    stripe: { configured: true },
    twilio: { accountConfigured: false, senderConfigured: true },
  },
});

assert.strictEqual(brief.metrics.accounts_total, 2);
assert.strictEqual(brief.metrics.accounts_active, 1);
assert.strictEqual(brief.metrics.legal_reviews, 1);
assert.strictEqual(brief.metrics.client_requests, 1);
assert.ok(brief.priorities.some(item => item.type === 'integration' && item.detail.includes('Twilio')));
assert.ok(brief.priorities.some(item => item.type === 'legal_audit'));
assert.ok(brief.priorities.some(item => item.type === 'client_request'));
assert.ok(brief.priorities.some(item => item.type === 'account' && item.title === 'Review Plumbing'));
assert.ok(brief.manualSupport.some(item => item.includes('legal audit')));
assert.ok(brief.auditTasks.length >= 3);
assert.ok(brief.coldCallingTasks.length >= 3);

console.log('autonomous ops tests passed');
