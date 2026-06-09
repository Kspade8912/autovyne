const SERVICE_DEFINITIONS = [
  {
    key: 'ai_calling',
    label: 'AI Calling',
    description: 'AI receptionist and missed-call handling.',
  },
  {
    key: 'sms_followup',
    label: 'SMS Follow-up',
    description: 'Text follow-up for contacts with recorded consent.',
  },
  {
    key: 'crm_sync',
    label: 'CRM Sync',
    description: 'Lead logging and CRM contact updates.',
  },
  {
    key: 'n8n_workflows',
    label: 'Workflow Automation',
    description: 'n8n handoffs, reminders, and deeper automation steps.',
  },
  {
    key: 'openai_qualification',
    label: 'AI Lead Review',
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
  starter: 'Starter includes core AI calling, SMS follow-up, CRM sync, and AI lead review. Workflow automation upgrades at Professional.',
  professional: 'Professional includes the full automation stack for booking, reminders, CRM, and workflow handoff.',
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
