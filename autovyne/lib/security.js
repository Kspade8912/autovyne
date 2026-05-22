/**
 * lib/security.js
 * Owns: security middleware (rate limiting, input sanitization, honeypot validation).
 * Does NOT own: CORS or HTTP header configuration (server.js).
 */

/** ─── Rate Limiter ──────────────────────────────────────────────────────────── */
/**
 * Simple in-memory sliding-window rate limiter.
 * Tracks requests per key (IP by default) over a configurable window.
 * Suitable for small-to-medium traffic; does not persist across restarts.
 */
function createRateLimiter({ windowMs = 15 * 60 * 1000, maxRequests = 100, message = 'Too many requests, please try again later.' } = {}) {
  const store = new Map(); // key → { count, resetAt }

  // Periodic cleanup to prevent memory leak (every 5 minutes)
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, val] of store) {
      if (now > val.resetAt) store.delete(key);
    }
  }, 5 * 60 * 1000);
  cleanup.unref();

  return function rateLimiter(req, res, next) {
    const key = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    if (!store.has(key) || now > store.get(key).resetAt) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    const entry = store.get(key);
    entry.count++;

    if (entry.count > maxRequests) {
      res.setHeader('Retry-After', Math.ceil(windowMs / 1000));
      return res.status(429).json({ error: message });
    }

    next();
  };
}

/** ─── XSS Sanitizer ─────────────────────────────────────────────────────────── */
/**
 * Strip HTML tags and encode dangerous characters that could enable XSS.
 * Safe for use on plain-text fields that should never contain markup.
 * Returns a sanitized string safe for DB insertion and display.
 *
 * Order matters: strip raw HTML tags FIRST (while < > are still literal),
 * then HTML-encode whatever remains so it renders as plain text everywhere.
 */
function sanitizeString(str) {
  if (typeof str !== 'string') return '';

  return str
    // 1. Strip HTML/script tags while they still contain literal < >
    .replace(/<\/?[a-z][a-z0-9]*[^>]*>/gi, '')
    // 2. Strip residual angle brackets (e.g. broken tags, injected fragments)
    .replace(/</g, '')
    .replace(/>/g, '')
    // 3. HTML-encode the remaining safe plain-text characters
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    // 4. Trim whitespace
    .trim();
}

/** ─── Honeypot + Min-Submit-Time Validator ──────────────────────────────────── */
/**
 * Rejects submissions that are:
 * 1. Detected as a bot via a filled-in hidden honeypot field
 * 2. Submitted faster than minSubmitMs (fast bots)
 *
 * Returns an error object with `reject: true` if blocked, or null if clean.
 */
function validateSubmission(req, { honeypotField = '_honey', minSubmitMs = 3000 } = {}) {
  const body = req.body || {};

  // Honeypot check: bots often fill every field including hidden ones
  if (honeypotField && body[honeypotField] && body[honeypotField].toString().trim() !== '') {
    return { reject: true, reason: 'Bot detected' };
  }

  // Min-submit-time check: fast submissions (< minSubmitMs) are suspicious
  const formLoadedAt = parseInt(req.headers['x-form-loaded-at'] || body._form_loaded_at, 10);
  if (formLoadedAt && Date.now() - formLoadedAt < minSubmitMs) {
    return { reject: true, reason: 'Submission too fast' };
  }

  return null;
}

module.exports = {
  createRateLimiter,
  sanitizeString,
  validateSubmission,
};