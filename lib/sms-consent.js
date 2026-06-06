const SMS_CONSENT_TEXT = 'By checking this box, I consent to receive SMS messages from Autovyne related to my account, audit request, onboarding, missed-call automation, and service updates. Message frequency varies. Message and data rates may apply. Reply STOP to opt out and HELP for help. Consent is not a condition of purchase. View our Privacy Policy and SMS Terms.';

function hasSmsConsent(value) {
  return value === true || value === 'true' || value === 'on' || value === '1';
}

function getRequestIp(req) {
  return req.ip || req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket?.remoteAddress || null;
}

module.exports = { SMS_CONSENT_TEXT, hasSmsConsent, getRequestIp };
