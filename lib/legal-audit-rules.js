const LEGAL_AUDIT_STATUS = {
  needs_admin_review: 'Needs Admin Review',
  approved: 'Approved',
  resolved: 'Resolved',
  dismissed: 'Dismissed',
};

const LEGAL_AUDIT_RULES = {
  block_contact: {
    riskArea: 'do_not_contact',
    severity: 'high',
    title: 'Do-not-contact review needed',
    summary: 'A customer asked Autovyne to block or stop contacting a caller. This should be reviewed before any additional outreach.',
    recommendedAction: 'Confirm the phone number, mark the contact as do-not-contact in connected systems, and document the decision.',
    references: ['TCPA/FCC consent revocation', 'FTC Telemarketing Sales Rule', 'State no-call rules'],
  },
  pause_follow_up: {
    riskArea: 'consent_sensitive_follow_up',
    severity: 'high',
    title: 'Follow-up pause review needed',
    summary: 'A customer asked Autovyne to pause automated follow-up. This may affect SMS, calls, and workflow routing.',
    recommendedAction: 'Pause affected outreach until consent, status, and business rules are reviewed.',
    references: ['TCPA/FCC opt-out handling', 'SMS consent records', 'Customer workflow authority'],
  },
  resume_follow_up: {
    riskArea: 'consent_review',
    severity: 'high',
    title: 'Resume follow-up requires consent review',
    summary: 'A customer asked Autovyne to resume follow-up. Resuming outreach should be reviewed before messages or calls restart.',
    recommendedAction: 'Verify the recipient relationship, consent records, opt-out status, and customer instructions before resuming.',
    references: ['TCPA/FCC prior express consent', 'Suppression-list management', 'Customer lead consent'],
  },
  review_conversation: {
    riskArea: 'conversation_review',
    severity: 'medium',
    title: 'Conversation review requested',
    summary: 'A customer asked Autovyne to review a call, message, transcript, or AI handling issue.',
    recommendedAction: 'Review only the minimum necessary activity details and avoid exposing sensitive data in customer-visible notes.',
    references: ['Call recording consent', 'Privacy/data minimization', 'AI output review'],
  },
  update_business_rules: {
    riskArea: 'workflow_change',
    severity: 'medium',
    title: 'Automation rule change needs review',
    summary: 'A customer asked Autovyne to change automation behavior, routing, scripts, or follow-up rules.',
    recommendedAction: 'Confirm the requested change, check whether it affects consent or regulated communications, then update workflows.',
    references: ['TCPA/FCC AI voice and text rules', 'FTC AI claims guidance', 'Customer script approval'],
  },
  privacy_data_request: {
    riskArea: 'privacy_data_request',
    severity: 'high',
    title: 'Privacy or data request needs review',
    summary: 'A customer submitted a privacy or data-handling request. This may require access, correction, deletion review, or data minimization.',
    recommendedAction: 'Verify requester authority, identify affected systems, and document the response before taking action.',
    references: ['CCPA/CPRA-style privacy rights', 'Data minimization', 'Identity/authority verification'],
  },
  billing_subscription_request: {
    riskArea: 'billing_subscription',
    severity: 'medium',
    title: 'Billing or subscription review needed',
    summary: 'A customer submitted a billing, subscription, pause, or cancellation request.',
    recommendedAction: 'Review subscription status, payment method, cancellation timing, and any applicable customer agreement before changing service.',
    references: ['FTC negative-option guidance', 'Stripe subscription state', 'Customer agreement/refund terms'],
  },
};

function normalizeAuditStatus(value) {
  return LEGAL_AUDIT_STATUS[value] ? value : 'needs_admin_review';
}

function buildLegalAuditDraftFromClientAction(request = {}, account = {}) {
  const rule = LEGAL_AUDIT_RULES[request.request_type] || LEGAL_AUDIT_RULES.review_conversation;
  const subject = request.subject_phone
    ? ` Phone: ${request.subject_phone}${request.subject_name ? ` (${request.subject_name})` : ''}.`
    : '';
  const customerNote = request.reason ? ` Customer note: ${request.reason}` : '';

  return {
    sourceRecordType: 'client_action_request',
    sourceRecordId: request.id,
    accountId: request.account_id || account.id || null,
    riskArea: rule.riskArea,
    severity: rule.severity,
    status: 'needs_admin_review',
    title: rule.title,
    summary: `${rule.summary}${subject}${customerNote}`.slice(0, 1600),
    recommendedAction: rule.recommendedAction,
    auditLevel: 'legal_audit_ai',
    auditModel: process.env.LEGAL_AUDIT_MODEL || process.env.OPENAI_MODEL || 'rule-guided',
    requiresAdminApproval: true,
    metadata: {
      request_type: request.request_type,
      request_priority: request.priority,
      request_status: request.status,
      account_business_name: account.business_name,
      compliance_flags: request.compliance_flags || {},
      reference_topics: rule.references || [],
      legal_note: 'Compliance support only. Not legal advice. Admin approval required before action.',
    },
  };
}

module.exports = {
  LEGAL_AUDIT_STATUS,
  buildLegalAuditDraftFromClientAction,
  normalizeAuditStatus,
};
