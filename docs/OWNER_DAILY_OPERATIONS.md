# Autovyne Owner Daily Operations

Use this routine before and after outreach days. It is written for a solo owner so the work stays simple, visible, and repeatable.

## Before Cold Calling

1. Open `/admin/launch`.
2. Check the Signup-to-Operations Rehearsal score.
3. Open `/admin/test-center?run=true` and confirm public pages, config checks, rehearsal rows, and monitoring rows.
4. Open `/admin/accounts` and confirm the demo account is active.
5. Log into `/portal` with `demo@autovyne.com` and `AutovyneDemo2026!` so you can show the customer view.
6. Open `/admin/outreach` and review call targets.
7. Keep SMS outreach paused unless Twilio approval and consent proof are confirmed.

## During Outreach

1. Use the sales scripts at the bottom of `/admin/outreach`.
2. Do not promise guaranteed revenue, guaranteed compliance, or instant automation.
3. Mark any opt-out, wrong number, or do-not-contact request immediately.
4. If someone asks for a demo, show `/tutorial` and the demo portal.
5. If someone asks detailed legal, billing, or privacy questions, route it to support/review instead of improvising.

## After Outreach

1. Open `/admin/questions` and answer or triage any new questions.
2. Open `/admin/accounts` and update account statuses or activity events.
3. Open `/admin/legal-audits` and review any item marked `needs_admin_review`.
4. Open `/admin/launch` and check recent automation alerts.
5. Confirm HubSpot and n8n received the expected diagnostic or lead events.

## Stop Conditions

Pause outreach if any of these happen:

- Signup checkout is failing.
- Portal login is failing.
- Database health is failing.
- HubSpot or n8n events are failing repeatedly.
- SMS consent proof is missing for a planned SMS send.
- A lead or customer asks not to be contacted.
- You are unsure whether a workflow is legally allowed.

## Manual Items That Stay Outside the Code

- Twilio toll-free approval and sender verification.
- Controlled Stripe live checkout/payment test.
- Final legal entity, business address, refund, cancellation, and customer agreement review.
- Custom domain DNS/SSL cleanup when you are ready to revisit `autovyne.com`.
