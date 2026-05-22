// Fail fast if DATABASE_URL is missing
if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const express = require('express');
const path = require('path');
const { buildLandingContext } = require('./lib/landing-context');
const { createRateLimiter } = require('./lib/security');

const app = express();
const port = process.env.PORT || 3000;

// Trust proxy (Render uses reverse proxy)
app.set('trust proxy', 1);

// ── Security Headers (Helmet-style) ──────────────────────────────────────────
app.use((req, res, next) => {
  res.set({
    // Prevent clickjacking
    'X-Frame-Options': 'SAMEORIGIN',
    // Prevent MIME sniffing
    'X-Content-Type-Options': 'nosniff',
    // Referrer policy — minimal referrer on outbound links
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    // XSS protection (legacy browsers)
    'X-XSS-Protection': '1; mode=block',
    // HSTS — enforce HTTPS for 1 year; Render always serves over HTTPS
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    // Content Security Policy — restrict scripts to self + trusted CDN
    'Content-Security-Policy': [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com",
      "frame-src 'self'",
      "img-src 'self' data: https://www.google-analytics.com https://www.googletagmanager.com https://*.google-analytics.com https://*.googletagmanager.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' https://www.google-analytics.com https://analytics.google.com",
    ].join('; '),
  });
  next();
});

// ── CORS — restrict to known domains ─────────────────────────────────────────
const ALLOWED_ORIGINS = [
  'https://autovyne.polsia.app',
  'https://autovyne.com',
  'http://localhost:3000',
  'http://127.0.0.1:3000',
];
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Form-Loaded-At');
  }
  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }
  next();
});

// ── Global Rate Limiter: 100 req / 15 min per IP ──────────────────────────────
app.use(createRateLimiter({ windowMs: 15 * 60 * 1000, maxRequests: 100 }));

// ── Body Parsers ───────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// ── EJS View Engine ───────────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Inject themeCSS + analyticsSnippet into all res.render calls
app.use((req, res, next) => {
  const ctx = buildLandingContext();
  res.locals.themeCSS = ctx.themeCSS;
  res.locals.analyticsSnippet = ctx.analyticsSnippet;
  next();
});

// ── Health Check (required for Render, no DB query to allow Neon auto-suspend) ─
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// ── Static Files ──────────────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public'), { index: false }));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.render('layout', {
    ...buildLandingContext(),
    seo: {
      title: 'Autovyne — AI Automation for Local Businesses',
      description: 'AI automation that captures every lead. Chatbots, voice receptionists, scheduling — built for local businesses.',
      ogTitle: 'Autovyne — AI Automation for Local Businesses',
      ogDescription: 'AI automation that captures every lead. Chatbots, voice receptionists, scheduling — built for local businesses.',
      ogImage: 'https://pub-629428d185ca4960a0a73c850d32294b.r2.dev/generated-images/company_136332/e0fbc7b1-c6a9-410d-b27f-7cae6bf1e794.jpg',
      ogUrl: 'https://autovyne.polsia.app',
      canonical: 'https://autovyne.polsia.app',
    },
  });
});

app.use('/roi', require('./routes/roi'));
app.use('/intake', require('./routes/intake'));
app.use('/results', require('./routes/results'));
app.use('/hvac', require('./routes/hvac'));
app.use('/hair-and-beauty', require('./routes/hair-and-beauty'));
app.use('/contractors', require('./routes/contractors'));
app.use('/towing-and-automotive', require('./routes/towing-and-automotive'));
app.use('/restaurants-and-hospitality', require('./routes/restaurants-and-hospitality'));
app.use('/medical-and-dental', require('./routes/medical-and-dental'));
app.use('/api/leads', require('./routes/leads'));
app.use('/simulator', require('./routes/simulator'));
app.use('/demo', require('./routes/demo'));

// ── Error Handler (generic — no stack traces in production) ──────────────────
app.use((err, _req, res, _next) => {
  console.error('[error]', err.message);
  if (process.env.NODE_ENV === 'production') {
    res.status(500).send('<h1>Something went wrong</h1><p>Please try again later.</p>');
  } else {
    res.status(500).send('<h1>Error</h1><pre>' + err.stack + '</pre>');
  }
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});