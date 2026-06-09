const ACTION_TYPES = {
  block_contact: {
    label: 'Block / do not contact a caller',
    shortLabel: 'Block Caller',
    description: 'Ask Autovyne to stop outreach to a specific caller or lead.',
    requiresPhone: true,
    defaultPriority: 'urgent',
    complianceFlags: {
      do_not_contact: true,
      sms_opt_out_review: true,
      voice_do_not_call_review: true,
      stop_follow_up_until_reviewed: true,
    },
  },
  pause_follow_up: {
    label: 'Pause follow-up',
    shortLabel: 'Pause Follow-up',
    description: 'Ask Autovyne to pause automated follow-up for one caller or a workflow.',
    requiresPhone: false,
    defaultPriority: 'high',
    complianceFlags: {
      stop_follow_up_until_reviewed: true,
      consent_sensitive: true,
    },
  },
  resume_follow_up: {
    label: 'Resume follow-up',
    shortLabel: 'Resume Follow-up',
    description: 'Ask Autovyne to review whether follow-up can safely resume.',
    requiresPhone: false,
    defaultPriority: 'normal',
    complianceFlags: {
      consent_review_required: true,
      resume_requires_admin_approval: true,
    },
  },
  review_conversation: {
    label: 'Review a call or message',
    shortLabel: 'Review Activity',
    description: 'Ask Autovyne to review a call, message, transcript, or AI handling issue.',
    requiresPhone: false,
    defaultPriority: 'normal',
    complianceFlags: {
      recording_or_transcript_review: true,
      sensitive_data_minimization: true,
    },
  },
  update_business_rules: {
    label: 'Update automation rules',
    shortLabel: 'Update Rules',
    description: 'Ask Autovyne to change routing, booking rules, scripts, or follow-up behavior.',
    requiresPhone: false,
    defaultPriority: 'normal',
    complianceFlags: {
      workflow_change_review: true,
      customer_instruction_logged: true,
    },
  },
  privacy_data_request: {
    label: 'Privacy or data request',
    shortLabel: 'Privacy Request',
    description: 'Ask Autovyne to review access, correction, deletion, or data-handling requests.',
    requiresPhone: false,
    defaultPriority: 'high',
    complianceFlags: {
      privacy_request: true,
      data_subject_review: true,
      deletion_or_access_review: true,
    },
  },
  billing_subscription_request: {
    label: 'Billing or subscription request',
    shortLabel: 'Billing Request',
    description: 'Ask Autovyne to review billing, subscription, pause, or cancellation questions.',
    requiresPhone: false,
    defaultPriority: 'normal',
    complianceFlags: {
      subscription_request: true,
      owner_review_required: true,
    },
  },
};

const PRIORITIES = new Set(['normal', 'high', 'urgent']);

function normalizeActionType(value) {
  const key = String(value || '').trim().toLowerCase();
  return ACTION_TYPES[key] ? key : 'review_conversation';
}

function normalizePriority(value, fallback = 'normal') {
  const key = String(value || '').trim().toLowerCase();
  return PRIORITIES.has(key) ? key : fallback;
}

function getActionDefinition(value) {
  return ACTION_TYPES[normalizeActionType(value)];
}

function getActionOptions() {
  return Object.entries(ACTION_TYPES).map(([key, definition]) => ({ key, ...definition }));
}

function complianceFlagsForType(value) {
  return {
    ...getActionDefinition(value).complianceFlags,
    customer_submitted: true,
    admin_review_required: true,
  };
}

function customerActionLabel(value) {
  return getActionDefinition(value).label;
}

module.exports = {
  ACTION_TYPES,
  complianceFlagsForType,
  customerActionLabel,
  getActionDefinition,
  getActionOptions,
  normalizeActionType,
  normalizePriority,
};
