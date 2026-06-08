const assert = require('assert');
const Module = require('module');

const calls = [];
const fakePool = {
  query: async (sql, params) => {
    calls.push({ sql, params });
    if (sql.includes('INSERT INTO questions')) {
      return {
        rows: [{
          id: 10,
          name: params[0],
          business_name: params[1],
          email: params[2],
          phone: params[3],
          question: params[4],
          category: params[5],
          urgency: params[6],
          contact_preference: params[7],
          status: 'new',
        }],
      };
    }
    if (sql.includes('UPDATE questions SET')) {
      return {
        rows: [{
          id: params[0],
          status: params[1],
          owner_note: params[2] || null,
          admin_reply: params[3] || null,
        }],
      };
    }
    if (sql.includes('SELECT * FROM questions')) return { rows: [] };
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

const pool = require('./db');
const questions = require('./db/questions');

assert.equal(pool, fakePool);

(async () => {
  const created = await questions.createQuestion({
    name: 'Test Owner',
    businessName: 'Test Auto',
    email: 'owner@test.com',
    phone: '5551234567',
    category: 'sms',
    urgency: 'urgent',
    contactPreference: 'phone',
    question: 'Can Autovyne follow up with missed calls?',
  });

  assert.equal(created.category, 'sms');
  assert.equal(created.urgency, 'urgent');
  assert.equal(created.contact_preference, 'phone');
  assert.equal(calls[0].params[5], 'sms');
  assert.equal(calls[0].params[6], 'urgent');
  assert.equal(calls[0].params[7], 'phone');

  const updated = await questions.updateQuestionStatus({
    id: 10,
    status: 'not_real',
    ownerNote: 'Needs owner follow-up.',
    adminReply: 'I will follow up today.',
  });

  assert.equal(updated.status, 'new');
  assert.equal(updated.owner_note, 'Needs owner follow-up.');
  assert.equal(updated.admin_reply, 'I will follow up today.');

  console.log('Question queue smoke test passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
