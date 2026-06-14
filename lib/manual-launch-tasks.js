function makeTask({ key, title, owner, status, detail, action, href }) {
  return { key, title, owner, status, detail, action, href };
}

function taskLabel(status) {
  if (status === 'done') return 'Done';
  if (status === 'blocked') return 'Blocked';
  if (status === 'external') return 'External';
  return 'Manual';
}

function buildManualLaunchTasks({ integrations = {}, accounts = [], snapshot = {} } = {}) {
  const twilioConfigured = Boolean(integrations.twilio?.configured);
  const stripeReady = Boolean(
    integrations.stripe?.checkoutConfigured &&
    integrations.stripe?.webhookConfigured &&
    Object.values(integrations.stripe?.pricesConfigured || {}).every(Boolean)
  );
  const aiOpsReady = Boolean(integrations.openai?.configured && integrations.hubspot?.configured && integrations.n8n?.configured);
  const hasDemoAccount = accounts.some(account => String(account.email || '').toLowerCase() === 'demo@autovyne.com');
  const consentCount = (snapshot.consents || []).filter(consent => consent.consented).length;

  return [
    makeTask({
      key: 'twilio_registration',
      title: 'Twilio toll-free approval and sender readiness',
      owner: 'Autovyne owner + Twilio',
      status: twilioConfigured ? 'manual' : 'blocked',
      detail: twilioConfigured
        ? 'Credentials/sender are present. Still confirm toll-free verification approval before production SMS.'
        : 'Outbound SMS is blocked until Twilio credentials and sender are configured in Render.',
      action: 'Check Twilio Console, sender verification, STOP/HELP behavior, and Render Twilio env values.',
      href: '/admin/integrations',
    }),
    makeTask({
      key: 'domain_tls',
      title: 'Custom domain TLS check',
      owner: 'Autovyne owner + IONOS/Render',
      status: 'external',
      detail: 'Render URL is working. autovyne.com still needs a final browser/TLS check before it becomes the outreach link.',
      action: 'Use the Render URL for outreach until autovyne.com loads reliably over HTTPS.',
      href: '/admin/test-center',
    }),
    makeTask({
      key: 'live_checkout_rehearsal',
      title: 'Controlled live checkout rehearsal',
      owner: 'Autovyne owner',
      status: stripeReady ? 'manual' : 'blocked',
      detail: stripeReady
        ? 'Stripe configuration is ready. A real controlled checkout/refund decision still needs owner handling.'
        : 'Stripe checkout or webhook configuration needs review before accepting automatic payments.',
      action: 'Run one controlled live signup, verify portal activation, then refund or keep the payment according to your test plan.',
      href: '/signup',
    }),
    makeTask({
      key: 'demo_account',
      title: 'Polished demo customer account',
      owner: 'Autovyne owner',
      status: hasDemoAccount ? 'done' : 'manual',
      detail: hasDemoAccount
        ? 'Demo portal account exists for sales walkthroughs.'
        : 'Create the demo account before calls so owners can see what customers get after signup.',
      action: 'Use Account Command Center -> Create / Refresh Demo Account.',
      href: '/admin/accounts',
    }),
    makeTask({
      key: 'sms_consent_proof',
      title: 'SMS consent proof review',
      owner: 'Autovyne owner',
      status: consentCount > 0 ? 'manual' : 'blocked',
      detail: consentCount > 0
        ? `${consentCount} recent opted-in consent record(s) are visible. Review proof before any send.`
        : 'No recent opted-in SMS consent record is visible in the admin snapshot.',
      action: 'Open SMS Proof and confirm timestamp, phone, source, IP/user agent when available, and exact consent text.',
      href: '/admin/compliance',
    }),
    makeTask({
      key: 'ai_ops_rehearsal',
      title: 'AI/CRM/n8n handoff rehearsal',
      owner: 'Autovyne owner',
      status: aiOpsReady ? 'manual' : 'blocked',
      detail: aiOpsReady
        ? 'OpenAI, HubSpot, and n8n are configured. Visual dashboard confirmation still matters before live volume.'
        : 'OpenAI, HubSpot, or n8n configuration needs review.',
      action: 'Confirm the diagnostic HubSpot contact and n8n diagnostic event in their dashboards.',
      href: '/admin/integrations',
    }),
    makeTask({
      key: 'legal_business_review',
      title: 'Business/legal final review',
      owner: 'Autovyne owner + attorney/accountant if available',
      status: 'manual',
      detail: 'Templates are stronger, but final entity name, address, refund/cancellation terms, and regulated-workflow review need human approval.',
      action: 'Finalize business entity details, address, cancellation/refund language, and customer agreement process.',
      href: '/terms',
    }),
  ];
}

module.exports = {
  buildManualLaunchTasks,
  taskLabel,
};
