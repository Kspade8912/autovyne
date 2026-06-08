# Autovyne Launch Runbook

This runbook is the working checklist for taking Autovyne from signup to active customer management.

## Customer Flow

1. Customer visits `/signup`.
2. Customer chooses a monthly plan and billing method.
3. Automatic billing sends them to Stripe Checkout.
4. Stripe webhook confirms payment.
5. Autovyne creates/activates the customer portal account.
6. n8n receives the paid signup event.
7. Admin uses `/admin/accounts` to mark setup milestones visible to the customer.
8. Customer logs into `/portal` to see status, activity, and progress.
9. Automatic-billing customers can open Stripe billing management from the portal after activation.

## Required Live Environment Keys

Render must have these configured for launch:

- `DATABASE_URL`
- `COOKIE_SECRET`
- `ADMIN_API_KEY`
- `ADMIN_USERNAME`
- `ADMIN_PASSWORD`
- `OPENAI_API_KEY`
- `OPENAI_MODEL`
- `HUBSPOT_ACCESS_TOKEN`
- `N8N_WEBHOOK_URL`
- `N8N_WEBHOOK_SECRET`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`
- `STRIPE_PRICE_SMB_BUNDLE`
- `STRIPE_PRICE_STARTER`
- `STRIPE_PRICE_PROFESSIONAL`
- `STRIPE_PRICE_ENTERPRISE`
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`
- `PUBLIC_BASE_URL=https://autovyne.com`

Do not paste secret keys into chat, docs, GitHub, or tickets.

## Admin Daily Routine

Use `/admin` as the starting point.

1. Open **Integration Health** and confirm the launch stack is ready.
2. Open **Account Command Center**.
3. Filter accounts by `Needs attention`, `In setup`, or `Launch ready`.
4. Use quick updates instead of typing from scratch.
5. Check **SMS Proof** before any SMS outreach.
6. Keep customer-visible updates plain-English and useful.

## AI Stack Responsibilities

- **OpenAI**: reviews lead details, summarizes pain, and recommends next action.
- **HubSpot**: stores CRM contact/lead records.
- **n8n**: coordinates paid signup events, questions, lead handoffs, and workflow notifications.
- **Twilio**: sends SMS only where consent is recorded.
- **Stripe**: handles recurring subscription checkout and webhook payment confirmation.
- **Supabase/Postgres**: stores accounts, signup orders, consent proof, questions, activity, and analytics.

## SMS Compliance Guardrails

- SMS checkbox must stay unchecked by default.
- SMS eligibility must only be true when consent is recorded.
- Store phone, timestamp, form source, IP, user agent, and exact consent language.
- Keep `/privacy`, `/terms`, and `/sms-terms` public.
- Use STOP/HELP, message frequency, message/data rates, and carrier liability language.
- Do not send SMS to users who did not consent.

## Sandbox Testing

Do not switch the live Render service into sandbox mode during business hours.

Recommended setup:

1. Create a separate Render staging service.
2. Use Stripe test mode keys and test mode prices only.
3. Use a test webhook endpoint that points to staging.
4. Confirm checkout URLs start with `cs_test_`.
5. Complete a test checkout.
6. Confirm the portal account activates.
7. Confirm n8n receives `account.paid`.
8. Confirm admin sees the account and customer portal shows the correct progress.

Never mix live price IDs with test secret keys.

## Stripe Customer Billing Portal

Autovyne can send automatic-billing customers from `/portal` to Stripe's hosted billing portal.

Before using this live:

1. Stripe Dashboard -> Settings -> Billing -> Customer portal.
2. Enable the portal.
3. Allow customers to update payment methods.
4. Decide whether customers can cancel subscriptions directly or must contact Autovyne.
5. Save the portal configuration.
6. Test with a paid account that has a Stripe customer ID.

If Stripe Customer Portal is not configured, the portal button can appear but Stripe will reject the session request.

## Stripe Webhook Events

The live webhook endpoint is:

```text
https://autovyne.com/signup/stripe-webhook
```

Configure snapshot events for:

- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `customer.subscription.deleted`

What Autovyne does:

- Checkout completion activates the customer portal and queues onboarding.
- Successful renewal records a customer-visible billing event.
- Failed payment marks the account as `needs_attention`.
- Deleted subscription marks the account as `paused`.

## Customer Onboarding Checklist

For each paid customer:

1. Confirm payment and account activation.
2. Confirm SMS consent before SMS workflows.
3. Connect or create CRM destination.
4. Configure AI call workflow.
5. Configure missed-call/SMS follow-up workflow.
6. Add quick admin update: `Onboarding started`.
7. Add quick admin update: `AI calling connected`.
8. Add quick admin update: `HubSpot connected`.
9. Add quick admin update: `n8n workflow connected`.
10. Add quick admin update: `Launch-ready check complete`.

## Launch Smoke Tests

Run locally before pushing:

```bash
node test-simulator.js
node test-integrations.js
node test-stripe.js
```

Live checks after Render deploy:

- `/health` returns healthy.
- `/signup` loads.
- A valid automatic signup returns a Stripe Checkout redirect.
- `/portal` loads.
- `/admin/integrations` redirects to admin login when not signed in.
- `/privacy`, `/terms`, and `/sms-terms` load publicly.

## When Something Fails

- Stripe checkout fails: check `STRIPE_SECRET_KEY` mode and price IDs.
- Webhook rejects events: check `STRIPE_WEBHOOK_SECRET`.
- Portal does not activate: check Stripe webhook delivery logs.
- n8n does not receive signup: check `N8N_WEBHOOK_URL` and `N8N_WEBHOOK_SECRET`.
- HubSpot does not receive leads: check `HUBSPOT_ACCESS_TOKEN`.
- SMS should not send: confirm consent record exists before enabling SMS follow-up.
