# Manual Support Launch Tasks

Use this list for work that software can guide, but cannot fully finish without a human reviewing an outside dashboard, legal/business detail, or live account status.

## Must Finish Before Scaling Outreach

1. **Twilio toll-free and sender readiness**
   - Confirm toll-free verification is approved.
   - Confirm Render has `TWILIO_ACCOUNT_SID`, either `TWILIO_API_KEY`/`TWILIO_API_SECRET` or `TWILIO_AUTH_TOKEN` for outbound API calls, `TWILIO_AUTH_TOKEN` for webhook signature validation, and either `TWILIO_PHONE_NUMBER` or `TWILIO_MESSAGING_SERVICE_SID`.
   - Send only consent-backed SMS. Test STOP and HELP before live volume.

2. **Custom domain HTTPS**
   - Use `https://autovyne-oj8a.onrender.com` until `https://autovyne.com` passes a clean browser and command-line HTTPS check.
   - Check IONOS DNS, Render custom domain status, CNAME/A-record targets, and certificate status.

3. **Controlled live Stripe checkout**
   - Run one real controlled checkout using the public signup page.
   - Confirm the account appears in `/admin/accounts`.
   - Confirm the customer can log in to `/portal`.
   - Confirm Stripe webhook delivery shows success.
   - Decide whether to refund the test charge or keep it as a real internal payment record.

4. **HubSpot and n8n visual confirmation**
   - In HubSpot, confirm `integration-test@autovyne.com` exists or was updated.
   - In n8n, confirm `diagnostic.autovyne` was received.
   - For the first real customer, confirm `account.paid` or `account.manual_billing_requested` arrives.

5. **Business/legal final review**
   - Finalize company legal entity name, business address, refund/cancellation wording, support email, and payment terms.
   - Attorney review is strongly recommended before mass outreach, AI calling, or SMS scale-up.
   - Do not promise guaranteed revenue, guaranteed compliance, guaranteed bookings, or perfect AI behavior.

6. **Demo account rehearsal**
   - Create or refresh the demo account from `/admin/accounts`.
   - Log in as the demo customer before calling prospects.
   - Practice the path: demo -> signup -> payment/onboarding -> portal -> Action Center -> support question.

## Daily Owner Routine

1. Open `/admin/launch`.
2. Open `/admin/integrations` and run deep diagnostics.
3. Open `/admin/outreach` and work the Launch-Day Call Tracker.
4. Open `/admin/questions` and clear urgent support items.
5. Open `/admin/legal-audits` before approving any contact block, resume-follow-up, privacy, billing, or compliance-sensitive workflow change.
6. Open `/admin/accounts` and add customer-visible updates after meaningful progress.

## Manual Stop Conditions

Stop and review manually when any of these happen:

- A lead or customer says stop, wrong number, remove me, do not contact, or unsubscribe.
- A customer asks to resume follow-up after a pause or opt-out.
- A workflow touches SMS, AI voice, call recording, billing, privacy, cancellation, refunds, health/legal/financial facts, or sensitive customer data.
- Stripe reports failed payment, deleted subscription, disputed charge, or webhook errors.
- Twilio verification is rejected or sender status changes.
- OpenAI, HubSpot, n8n, Supabase, or Twilio diagnostics fail.
