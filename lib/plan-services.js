const SERVICE_DEFINITIONS = [
  {
    key: 'ai_calling',
    label: 'Call Follow-up',
    description: 'Missed-call handling, caller notes, and owner handoff.',
  },
  {
    key: 'sms_followup',
    label: 'Text Updates',
    description: 'Text follow-up for contacts with recorded consent.',
  },
  {
    key: 'crm_sync',
    label: 'Lead Tracker',
    description: 'Lead logging, contact notes, and follow-up status.',
  },
  {
    key: 'n8n_workflows',
    label: 'Booking & Follow-up Flow',
    description: 'Owner alerts, reminders, calendar handoffs, and deeper automation steps.',
  },
  {
    key: 'openai_qualification',
    label: 'Lead Review',
    description: 'AI summaries, lead qualification, and next-step guidance.',
  },
];

const PLAN_SERVICE_BUNDLES = {
  'smb-bundle': {
    ai_calling: true,
    sms_followup: true,
    crm_sync: true,
    n8n_workflows: true,
    openai_qualification: true,
  },
  starter: {
    ai_calling: true,
    sms_followup: true,
    crm_sync: true,
    n8n_workflows: false,
    openai_qualification: true,
  },
  professional: {
    ai_calling: true,
    sms_followup: true,
    crm_sync: true,
    n8n_workflows: true,
    openai_qualification: true,
  },
  enterprise: {
    ai_calling: true,
    sms_followup: true,
    crm_sync: true,
    n8n_workflows: true,
    openai_qualification: true,
  },
};

const PLAN_SERVICE_NOTES = {
  'smb-bundle': 'SMB Bundle includes the full small-business automation stack.',
  starter: 'Starter includes core call follow-up, text updates, lead tracking, and lead review. Booking and deeper handoffs upgrade at Professional.',
  professional: 'Professional includes the full CLEAR Stack: Calls, Leads, Engagement, Appointments, and Reporting.',
  enterprise: 'Enterprise includes the full stack plus higher-touch onboarding and custom integration support.',
};

function getPlanServiceBundle(plan) {
  return { ...(PLAN_SERVICE_BUNDLES[plan] || PLAN_SERVICE_BUNDLES.professional) };
}

function serviceRowsForPlan(plan) {
  const bundle = getPlanServiceBundle(plan);
  return SERVICE_DEFINITIONS.map(service => ({
    ...service,
    included: Boolean(bundle[service.key]),
  }));
}

function filterServicesForPlan(plan, services = {}) {
  const bundle = getPlanServiceBundle(plan);
  return SERVICE_DEFINITIONS.reduce((acc, service) => {
    acc[service.key] = Boolean(bundle[service.key] && services[service.key]);
    return acc;
  }, {});
}

module.exports = {
  filterServicesForPlan,
  getPlanServiceBundle,
  PLAN_SERVICE_BUNDLES,
  PLAN_SERVICE_NOTES,
  SERVICE_DEFINITIONS,
  serviceRowsForPlan,
};
