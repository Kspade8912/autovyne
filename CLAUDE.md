# CLAUDE.md

## What this app does
Autovyne is a client-facing intake portal for an AI automation agency. Local businesses submit their info, see a personalized ROI preview of what automation can recover for them, and view service packages with pricing.

## Stack
Node.js 20, Express 4, EJS, PostgreSQL (Neon), deployed on Render.

## Directory map
- `server.js` — App entry: middleware, route mounts, app.listen (wiring only)
- `routes/` — Express Router modules, one file per feature group
- `db/` — Pool singleton (`index.js`) + named query functions per entity
- `migrations/` — DDL-only `.js` migration files, run via `npm run migrate`
- `views/` — EJS templates; `layout.ejs` is root, partials in `views/partials/`
- `public/` — Static assets (CSS, images) served at `/`
- `lib/` — Shared utilities (landing context builder)
- `services/` — Shared service modules (email, etc.)

## Database
- `users` — Polsia-managed end-user accounts with subscription fields
- `intake_submissions` — Client prospect intake form data: biz info, industry, current tools, ROI estimates
- `leads` — Prospect leads stored via `/api/leads`: biz name, industry, call volume, miss rate, email, estimated missed leads/loss
- `page_views` — Self-hosted analytics events: page views, form submissions, CTA clicks, demo interactions

## External integrations
- Email (internal notifications): nodemailer via SMTP (env vars: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM, LEAD_NOTIFY_EMAIL)
- Email (prospect auto-replies): Polsia email proxy at polsia.com/api/proxy/email (env var: POLSIA_API_KEY, auto-provisioned)

## Recent changes
- 2026-06-02: Added trust bar (Setup in 20 mins / No contracts / Captures 95%+ of missed calls) above CTA in closing.ejs. Added testimonials section with 3 placeholder testimonials to landing page and /hvac page — swap with real customer quotes when available.
- 2026-05-24: Self-hosted analytics: `page_views` table (migration 1748049000000), `/api/analytics` POST endpoint for client-side beacon, `/admin/analytics` password-protected dashboard with daily charts for page views, form submissions, top pages, and top referrers. Client script: `public/js/analytics.js` — fires on page load, form submit, CTA click, and demo slider (aggregate). No external analytics services.
- 2026-05-23: Auto-reply email on lead submit: added optional email field to intake form and `leads` table, `sendAutoReply()` in services/email.js uses Polsia email proxy to send personalized results + CTA to prospect (fire-and-forget, 24h dedup by business_name). Migration: 1748216400000_add_email_to_leads.js.
- 2026-05-22: Security hardening (final pass): Fixed `sanitizeString` logic order (strip HTML tags before encoding — prior version encoded first, breaking tag-strip regex). Added `views/404.ejs` (missing, was crashing on unknown lead IDs). Locked `GET /api/leads` behind `Authorization: Bearer <ADMIN_API_KEY>` header — was publicly readable. Env var: `ADMIN_API_KEY`.
- 2026-05-22: Security hardening complete: HSTS (Strict-Transport-Security 1yr) added, bot protection (honeypot + 3s min-submit) applied to /intake POST route in addition to /api/leads. Confirmed all EJS renders use escaped `<%= %>` for user data; all DB queries parameterized ($1/$2/…). Audit of all security layers: headers, CORS, rate limiting, XSS sanitization, parameterized SQL, bot/spam protection, generic error pages.
- 2026-05-22: Added `/demo` — Live Business Simulator: split-screen (Without vs With Autovyne), animated counters, live activity feed, speed controls (1×/2×/5×), month scrubber, 12-month year simulation, final summary stats. Pre-loaded data for all 6 verticals. Route: `routes/demo.js`, view: `views/demo.ejs`. Nav "▶ Live Demo" link added.
- 2026-05-22: Added `/roi` — Enhanced ROI Calculator page with real-time sliders (leads/month, avg ticket, missed call %, conversion rate), 12-month canvas projection chart, breakeven month highlight, total savings/ROI stats, 6-industry preset selector (dropdown auto-adjusts sliders), shareable URL (query params encode all values), CTA → /intake. Route: `routes/roi.js`, view: `views/roi.ejs`. Nav includes "ROI Calculator" link.
