const SERVICE_KEYS = ['ai_calling', 'sms_followup', 'crm_sync', 'n8n_workflows', 'openai_qualification'];

function serviceCompletion(account = {}) {
  const services = account.services || {};
  const active = SERVICE_KEYS.filter(key => services[key]).length;
  return {
    active,
    total: SERVICE_KEYS.length,
    percent: SERVICE_KEYS.length ? Math.round((active / SERVICE_KEYS.length) * 100) : 0,
  };
}

function step(status, title, detail, owner = 'Autovyne', manual = false) {
  return { status, title, detail, owner, manual };
}

function statusLabel(status) {
  if (status === 'done') return 'Done';
  if (status === 'review') return 'Review';
  if (status === 'blocked') return 'Blocked';
  return 'Setup';
}

function buildOnboardingChecklist(account = {}) {
  const services = account.services || {};
  const completion = serviceCompletion(account);
  const billingMethod = account.billing_method || 'automatic';
  const isManualBilling = billingMethod === 'manual';
  const isActive = account.status === 'active';
  const isPaused = account.status === 'paused';
  const needsAttention = account.status === 'needs_attention';

  const rows = [
    step(
      account.id ? 'done' : 'setup',
      'Signup and account record',
      account.id
        ? 'Autovyne has the customer account record and portal login path.'
        : 'Customer signup details still need to be captured.',
      'Customer + Autovyne'
    ),
    step(
      account.paid_at || isManualBilling ? (isManualBilling ? 'review' : 'done') : 'setup',
      'Payment and billing method',
      isManualBilling
        ? 'Manual monthly billing needs owner confirmation before paid setup should move forward.'
        : account.paid_at
          ? 'Stripe confirmed the initial subscription payment.'
          : 'Stripe checkout/payment confirmation is still needed.',
      isManualBilling ? 'Autovyne owner' : 'Stripe',
      isManualBilling
    ),
    step(
      account.activated_at ? 'done' : 'setup',
      'Portal activation',
      account.activated_at
        ? 'The customer can log in and see account status, activity, controls, and support paths.'
        : 'Portal activation happens after payment or manual approval.',
      'Autovyne'
    ),
    step(
      account.contact_name && account.phone && account.industry ? 'done' : 'review',
      'Business profile review',
      'Confirm hours, services, booking rules, escalation contact, FAQ answers, and preferred tone before live AI handling.',
      'Autovyne owner',
      true
    ),
    step(
      services.crm_sync ? 'done' : 'setup',
      'CRM destination',
      services.crm_sync
        ? 'CRM sync is marked active for this account.'
        : 'Choose or connect the CRM destination before lead handoff is treated as live.',
      'Autovyne + HubSpot',
      !services.crm_sync
    ),
    step(
      services.ai_calling ? 'done' : 'setup',
      'AI calling workflow',
      services.ai_calling
        ? 'AI calling is marked active and ready for monitored usage.'
        : 'Build and test the call script, fallback, after-hours behavior, and human handoff.',
      'Autovyne owner',
      !services.ai_calling
    ),
    step(
      services.sms_followup ? 'review' : 'setup',
      'SMS consent and message rules',
      services.sms_followup
        ? 'SMS follow-up is enabled, but consent proof must be checked before sending any message.'
        : 'SMS follow-up stays off until the sender is approved and consent proof exists.',
      'Autovyne owner',
      true
    ),
    step(
      services.n8n_workflows ? 'done' : 'setup',
      'Automation workflow handoff',
      services.n8n_workflows
        ? 'Workflow automation is marked active for account handoffs and notifications.'
        : 'Connect the workflow path for lead handoff, reminders, support, and internal alerts.',
      'Autovyne + n8n',
      !services.n8n_workflows
    ),
    step(
      completion.percent >= 80 && isActive ? 'done' : needsAttention ? 'review' : isPaused ? 'blocked' : 'setup',
      'Launch approval',
      isActive && completion.percent >= 80
        ? 'This account is marked launch-ready or live for monitored service.'
        : needsAttention
          ? 'This account needs owner review before the next setup step.'
          : isPaused
            ? 'This account is paused until billing, support, or compliance review is complete.'
            : 'Run the final review before marking the account active.',
      'Autovyne owner',
      !isActive
    ),
  ];

  return {
    rows,
    completion,
    doneCount: rows.filter(row => row.status === 'done').length,
    totalCount: rows.length,
    manualCount: rows.filter(row => row.manual && row.status !== 'done').length,
    statusLabel,
  };
}

module.exports = {
  buildOnboardingChecklist,
  serviceCompletion,
  statusLabel,
};
