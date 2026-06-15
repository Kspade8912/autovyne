const assert = require('assert');
const crypto = require('crypto');

process.env.TWILIO_ACCOUNT_SID = 'AC_unit';
process.env.TWILIO_AUTH_TOKEN = 'twilio_unit_token';
process.env.TWILIO_PHONE_NUMBER = '+15555550000';
process.env.PUBLIC_BASE_URL = 'https://autovyne.test';

const requests = [];
global.fetch = async (url, options = {}) => {
  requests.push({ url, options });
  if (url.endsWith('/AC_unit.json')) {
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ sid: 'AC_unit', status: 'active' }),
    };
  }
  return {
    ok: true,
    status: 200,
    text: async () => JSON.stringify({ sid: 'SM_unit', status: 'queued' }),
  };
};

const twilio = require('./services/twilio');

function signedRequest({ body, url = 'https://autovyne.test/twilio/sms' }) {
  const params = Object.keys(body)
    .sort()
    .map(key => `${key}${body[key]}`)
    .join('');
  const signature = crypto
    .createHmac('sha1', process.env.TWILIO_AUTH_TOKEN)
    .update(url + params)
    .digest('base64');

  return {
    protocol: 'https',
    originalUrl: new URL(url).pathname,
    body,
    headers: { 'user-agent': 'twilio-test' },
    get(name) {
      if (String(name).toLowerCase() === 'host') return new URL(url).host;
      if (String(name).toLowerCase() === 'x-twilio-signature') return signature;
      return undefined;
    },
  };
}

function responseRecorder() {
  return {
    statusCode: 200,
    body: '',
    headers: {},
    type(value) {
      this.headers['content-type'] = value;
      return this;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(body) {
      this.body = body;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
    end() {
      return this;
    },
  };
}

(async () => {
  assert.equal(twilio.isConfigured(), true);
  assert.equal(twilio.defaultStatusCallbackUrl(), 'https://autovyne.test/twilio/status');

  const blocked = await twilio.sendSms({ to: '+15555550123', body: 'No consent', smsConsent: false });
  assert.equal(blocked.skipped, true);
  assert.equal(requests.length, 0);

  const sent = await twilio.sendSms({ to: '+15555550123', body: 'With consent', smsConsent: true });
  assert.equal(sent.sid, 'SM_unit');
  const sendBody = new URLSearchParams(requests[0].options.body);
  assert.equal(sendBody.get('To'), '+15555550123');
  assert.equal(sendBody.get('From'), '+15555550000');
  assert.equal(sendBody.get('StatusCallback'), 'https://autovyne.test/twilio/status');

  requests.length = 0;
  const account = await twilio.validateAccount();
  assert.equal(account.ready, true);
  assert.equal(requests[0].url, 'https://api.twilio.com/2010-04-01/Accounts/AC_unit.json');

  requests.length = 0;
  delete process.env.TWILIO_TEST_TO_NUMBER;
  delete process.env.TWILIO_TEST_SMS_CONSENT;
  const skippedDiagnostic = await twilio.sendDiagnosticSms();
  assert.equal(skippedDiagnostic.skipped, true);
  assert.equal(requests.length, 0);

  process.env.TWILIO_TEST_TO_NUMBER = '+15555550123';
  process.env.TWILIO_TEST_SMS_CONSENT = 'true';
  const diagnostic = await twilio.sendDiagnosticSms();
  assert.equal(diagnostic.ready, true);

  const originalDb = require.cache[require.resolve('./db/sms-webhooks')];
  const originalCompliance = require.cache[require.resolve('./db/compliance')];
  const Module = require('module');
  const originalLoad = Module._load;
  Module._load = function patchedLoad(request, parent, isMain) {
    if (request === 'express') {
      return {
        Router() {
          const router = {
            stack: [],
            post(path, handle) {
              this.stack.push({
                route: {
                  path,
                  methods: { post: true },
                  stack: [{ handle }],
                },
              });
            },
          };
          return router;
        },
      };
    }
    return originalLoad.call(this, request, parent, isMain);
  };
  const smsEvents = [];
  const consentEvents = [];
  require.cache[require.resolve('./db/sms-webhooks')] = {
    exports: {
      recordSmsWebhookEvent: async (event) => {
        smsEvents.push(event);
        return event;
      },
    },
  };
  require.cache[require.resolve('./db/compliance')] = {
    exports: {
      recordSmsConsent: async (event) => {
        consentEvents.push(event);
        return event;
      },
    },
  };
  delete require.cache[require.resolve('./routes/twilio-webhooks')];
  const router = require('./routes/twilio-webhooks');
  const smsRoute = router.stack.find(layer => layer.route?.path === '/sms' && layer.route?.methods?.post).route.stack[0].handle;
  const statusRoute = router.stack.find(layer => layer.route?.path === '/status' && layer.route?.methods?.post).route.stack[0].handle;

  const helpRes = responseRecorder();
  await smsRoute(signedRequest({
    body: { From: '+15555550123', To: '+15555550000', Body: 'HELP', MessageSid: 'SM_help' },
  }), helpRes);
  assert.equal(helpRes.statusCode, 200);
  assert(helpRes.body.includes('Reply STOP to opt out'));
  assert.equal(smsEvents[0].eventType, 'help');

  const stopRes = responseRecorder();
  await smsRoute(signedRequest({
    body: { From: '+15555550123', To: '+15555550000', Body: 'STOP', MessageSid: 'SM_stop' },
  }), stopRes);
  assert.equal(consentEvents[0].consented, false);
  assert.equal(consentEvents[0].formSource, 'twilio_stop_keyword');

  const statusRes = responseRecorder();
  await statusRoute(signedRequest({
    url: 'https://autovyne.test/twilio/status',
    body: { MessageSid: 'SM_unit', MessageStatus: 'delivered', From: '+15555550000', To: '+15555550123' },
  }), statusRes);
  assert.equal(statusRes.statusCode, 204);
  assert.equal(smsEvents.at(-1).eventType, 'status_delivered');
  assert.equal(smsEvents.at(-1).direction, 'outbound');
  assert.equal(smsEvents.at(-1).messageStatus, 'delivered');

  if (originalDb) require.cache[require.resolve('./db/sms-webhooks')] = originalDb;
  if (originalCompliance) require.cache[require.resolve('./db/compliance')] = originalCompliance;
  Module._load = originalLoad;

  console.log('Twilio smoke test passed.');
})().catch(error => {
  console.error(error);
  process.exit(1);
});
