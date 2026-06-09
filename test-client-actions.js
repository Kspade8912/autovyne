const assert = require('assert');
const Module = require('module');

const calls = [];
const fakePool = {
  query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('INSERT INTO client_action_requests')) {
      return {
        rows: [{
          id: 55,
          account_id: params[0],
          request_type: params[1],
          subject_phone: params[2],
          subject_name: params[3],
          priority: params[4],
          reason: params[5],
          compliance_flags: JSON.parse(params[6]),
          requested_by_email: params[7],
        }],
      };
    }
    if (sql.includes('FROM client_action_requests') && sql.includes('WHERE account_id')) {
      return { rows: [{ id: 55, account_id: params[0], request_type: 'block_contact' }] };
    }
    if (sql.includes('FROM client_action_requests r') && sql.includes('WHERE r.id')) {
      return { rows: [{ id: params[0], account_id: 7, request_type: 'block_contact', business_name: 'Demo' }] };
    }
    if (sql.includes('UPDATE client_action_requests')) {
      return { rows: [{ id: params[0], status: params[1], admin_note: params[2] }] };
    }
    if (sql.includes('JOIN client_accounts')) {
      return { rows: [] };
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

const {
  complianceFlagsForType,
  normalizeActionType,
} = require('./lib/client-action-requests');
const {
  createClientActionRequest,
  getClientActionRequestById,
  listClientActionRequests,
  listRecentClientActionRequests,
  updateClientActionRequestStatus,
} = require('./db/client-actions');

assert.equal(normalizeActionType('not-real'), 'review_conversation');
assert.equal(complianceFlagsForType('block_contact').do_not_contact, true);
assert.equal(complianceFlagsForType('block_contact').admin_review_required, true);

(async () => {
  const request = await createClientActionRequest({
    accountId: 7,
    requestType: 'block_contact',
    subjectPhone: '555-010-0101',
    subjectName: 'Booked Customer',
    reason: 'Customer already booked. Stop follow-up.',
    requestedByEmail: 'owner@example.com',
  });

  assert.equal(request.request_type, 'block_contact');
  assert.equal(request.priority, 'urgent');
  assert.equal(request.compliance_flags.do_not_contact, true);
  assert.equal(calls[0].params[6].includes('stop_follow_up_until_reviewed'), true);

  const accountRequests = await listClientActionRequests(7);
  assert.equal(accountRequests[0].request_type, 'block_contact');

  const recentRequests = await listRecentClientActionRequests();
  assert.deepEqual(recentRequests, []);

  const found = await getClientActionRequestById(55);
  assert.equal(found.request_type, 'block_contact');

  const updated = await updateClientActionRequestStatus({
    id: 55,
    status: 'completed',
    adminNote: 'Blocked in connected systems.',
  });
  assert.equal(updated.status, 'completed');

  console.log('Client action request smoke test passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
