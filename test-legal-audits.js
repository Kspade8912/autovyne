const assert = require('assert');
const Module = require('module');

const calls = [];
const fakePool = {
  query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('INSERT INTO legal_audit_reviews')) {
      return {
        rows: [{
          id: 90,
          source_record_type: params[0],
          source_record_id: params[1],
          account_id: params[2],
          risk_area: params[3],
          severity: params[4],
          status: params[5],
          title: params[6],
          requires_admin_approval: params[11],
        }],
      };
    }
    if (sql.includes('FROM legal_audit_reviews l') && sql.includes('WHERE l.id')) {
      return { rows: [{ id: params[0], status: 'needs_admin_review' }] };
    }
    if (sql.includes('WHERE source_record_type')) {
      return { rows: [] };
    }
    if (sql.includes('FROM legal_audit_reviews l')) {
      return { rows: [] };
    }
    if (sql.includes('UPDATE legal_audit_reviews')) {
      return { rows: [{ id: params[0], status: params[1], resolution_note: params[2] }] };
    }
    throw new Error(`Unexpected query: ${sql}`);
  },
};

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
  if (request === 'pg') {
    return { Pool: function Pool() { return fakePool; } };
  }
  return originalLoad.call(this, request, parent, isMain);
};

const { buildLegalAuditDraftFromClientAction, normalizeAuditStatus } = require('./lib/legal-audit-rules');
const {
  createLegalAuditReview,
  getLegalAuditReviewById,
  getLegalAuditReviewBySource,
  listLegalAuditReviews,
  updateLegalAuditReviewStatus,
} = require('./db/legal-audits');

assert.equal(normalizeAuditStatus('bad'), 'needs_admin_review');

(async () => {
  const draft = buildLegalAuditDraftFromClientAction({
    id: 55,
    account_id: 7,
    request_type: 'block_contact',
    priority: 'urgent',
    subject_phone: '555-010-0101',
    reason: 'Customer already booked.',
    compliance_flags: { do_not_contact: true },
  }, { business_name: 'Demo HVAC' });

  assert.equal(draft.riskArea, 'do_not_contact');
  assert.equal(draft.severity, 'high');
  assert.equal(draft.requiresAdminApproval, true);

  const created = await createLegalAuditReview(draft);
  assert.equal(created.risk_area, 'do_not_contact');
  assert.equal(created.requires_admin_approval, true);

  const audits = await listLegalAuditReviews({ status: 'needs_admin_review' });
  assert.deepEqual(audits, []);

  const existing = await getLegalAuditReviewBySource({
    sourceRecordType: 'client_action_request',
    sourceRecordId: 55,
    riskArea: 'do_not_contact',
  });
  assert.equal(existing, null);

  const found = await getLegalAuditReviewById(90);
  assert.equal(found.status, 'needs_admin_review');

  const updated = await updateLegalAuditReviewStatus({
    id: 90,
    status: 'approved',
    resolutionNote: 'Verified DNC handling.',
  });
  assert.equal(updated.status, 'approved');

  console.log('Legal audit smoke test passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
