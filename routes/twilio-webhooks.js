const crypto = require('crypto');
const { Router } = require('express');
const { recordSmsConsent } = require('../db/compliance');
const { recordSmsWebhookEvent } = require('../db/sms-webhooks');
const { SMS_CONSENT_TEXT, getRequestIp } = require('../lib/sms-consent');

const router = Router();

const STOP_WORDS = new Set(['STOP', 'STOPALL', 'UNSUBSCRIBE', 'CANCEL', 'END', 'QUIT']);
const HELP_WORDS = new Set(['HELP', 'INFO']);
const START_WORDS = new Set(['START', 'UNSTOP', 'YES']);

function twiml(message) {
  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${escapeXml(message)}</Message></Response>`;
}

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function publicUrl(req) {
  return `${req.protocol}://${req.get('host')}${req.originalUrl}`;
}

function siteBase(req) {
  return (process.env.PUBLIC_BASE_URL || `${req.protocol}://${req.get('host')}`).replace(/\/$/, '');
}

function validateTwilioSignature(req) {
  if (!process.env.TWILIO_AUTH_TOKEN) return true;
  const signature = req.get('x-twilio-signature');
  if (!signature) return false;

  const params = Object.keys(req.body || {})
    .sort()
    .map(key => `${key}${req.body[key]}`)
    .join('');
  const expected = crypto
    .createHmac('sha1', process.env.TWILIO_AUTH_TOKEN)
    .update(publicUrl(req) + params)
    .digest('base64');

  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  return sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer);
}

function classify(body) {
  const firstWord = String(body || '').trim().split(/\s+/)[0]?.toUpperCase() || '';
  if (STOP_WORDS.has(firstWord)) return 'opt_out';
  if (HELP_WORDS.has(firstWord)) return 'help';
  if (START_WORDS.has(firstWord)) return 'opt_in_keyword';
  return 'message';
}

router.post('/sms', async (req, res) => {
  res.type('text/xml');

  if (!validateTwilioSignature(req)) {
    return res.status(403).send(twiml('Autovyne could not verify this request.'));
  }

  const fromPhone = req.body.From || req.body.FromCountry || null;
  const body = req.body.Body || '';
  const eventType = classify(body);

  try {
    await recordSmsWebhookEvent({
      messageSid: req.body.MessageSid || req.body.SmsMessageSid,
      fromPhone: req.body.From,
      toPhone: req.body.To,
      body,
      eventType,
      rawPayload: req.body,
    });

    if (eventType === 'opt_out') {
      await recordSmsConsent({
        phone: req.body.From,
        consented: false,
        formSource: 'twilio_stop_keyword',
        sourceRecordType: 'twilio_inbound_sms',
        sourceRecordId: null,
        ipAddress: getRequestIp(req),
        userAgent: req.headers['user-agent'] || null,
        consentText: 'Recipient replied with an SMS opt-out keyword.',
      });
      return res.send(twiml('Autovyne: You are opted out and will no longer receive SMS messages. Reply HELP for help.'));
    }

    if (eventType === 'help') {
      return res.send(twiml(`Autovyne: For help, email kwaun.autovyne@gmail.com or visit ${siteBase(req)}/sms-terms. Reply STOP to opt out.`));
    }

    if (eventType === 'opt_in_keyword') {
      await recordSmsConsent({
        phone: req.body.From,
        consented: true,
        formSource: 'twilio_start_keyword',
        sourceRecordType: 'twilio_inbound_sms',
        sourceRecordId: null,
        ipAddress: getRequestIp(req),
        userAgent: req.headers['user-agent'] || null,
        consentText: SMS_CONSENT_TEXT,
      });
      return res.send(twiml('Autovyne: You are opted in to receive service updates. Message frequency varies. Reply STOP to opt out or HELP for help.'));
    }

    return res.send(twiml('Autovyne: Message received. For help, reply HELP. Reply STOP to opt out.'));
  } catch (error) {
    console.error('[twilio-webhook] inbound sms error:', error.message);
    return res.status(500).send(twiml('Autovyne could not process this message right now.'));
  }
});

module.exports = router;
