const assert = require('assert');

process.env.ADMIN_API_KEY = 'unit-admin-key';

const { hasAdminApiAccess } = require('./lib/admin-api-auth');

assert.equal(hasAdminApiAccess({ signedCookies: {}, headers: {} }), false);
assert.equal(hasAdminApiAccess({
  signedCookies: { admin_auth: 'authorized' },
  headers: {},
}), true);
assert.equal(hasAdminApiAccess({
  signedCookies: {},
  headers: { authorization: 'Bearer unit-admin-key' },
}), true);
assert.equal(hasAdminApiAccess({
  signedCookies: {},
  headers: { authorization: 'Bearer wrong' },
}), false);

console.log('Admin API auth smoke test passed.');
