const { listRecentClientActionRequests } = require('../db/client-actions');
const { createLegalAuditReview, getLegalAuditReviewBySource } = require('../db/legal-audits');
const { buildLegalAuditDraftFromClientAction } = require('../lib/legal-audit-rules');
const { runLegalAuditAIReview } = require('./openai');

let monitorStarted = false;

async function createAuditFromClientAction(request) {
  const draft = buildLegalAuditDraftFromClientAction(request, {
    id: request.account_id,
    business_name: request.business_name,
    email: request.account_email,
  });

  const existing = await getLegalAuditReviewBySource({
    sourceRecordType: draft.sourceRecordType,
    sourceRecordId: draft.sourceRecordId,
    riskArea: draft.riskArea,
  });
  if (existing) return existing;

  const reviewedDraft = await runLegalAuditAIReview({
    subject: {
      source: 'client_action_request',
      request,
      account: {
        id: request.account_id,
        business_name: request.business_name,
        email: request.account_email,
      },
    },
    draft,
  }).catch(error => {
    console.error('[legal-audit] AI review fallback:', error.message);
    return draft;
  });

  return createLegalAuditReview(reviewedDraft);
}

async function runLegalAuditCycle({ limit = 50 } = {}) {
  const requests = await listRecentClientActionRequests({ limit });
  const audits = [];

  for (const request of requests) {
    if (['completed', 'denied'].includes(request.status)) continue;
    audits.push(await createAuditFromClientAction(request));
  }

  return audits;
}

function startLegalAuditMonitor() {
  if (monitorStarted) return;
  if (!process.env.DATABASE_URL) return;
  if (process.env.LEGAL_AUDIT_MONITOR_ENABLED === 'false') return;

  monitorStarted = true;
  const intervalMs = Number(process.env.LEGAL_AUDIT_INTERVAL_MS || 10 * 60 * 1000);

  setTimeout(() => {
    runLegalAuditCycle().catch(error => console.error('[legal-audit] startup cycle error:', error.message));
  }, 20 * 1000).unref?.();

  setInterval(() => {
    runLegalAuditCycle().catch(error => console.error('[legal-audit] interval cycle error:', error.message));
  }, intervalMs).unref?.();
}

module.exports = {
  createAuditFromClientAction,
  runLegalAuditCycle,
  startLegalAuditMonitor,
};
