# Autovyne Autonomous Launch Task List

This is the owner-facing work queue for moving Autovyne toward hands-off operation while keeping approval gates where they belong.

## 1. Autonomous Operations

- Generate the Admin Daily Ops Report every morning before outreach.
- Review priority items in this order: integrations, legal audits, client action requests, paused accounts, setup accounts.
- Keep AI-generated recommendations advisory unless a workflow is explicitly safe and already approved.
- Do not let AI send SMS, place calls, change billing, resolve legal audits, delete data, or change consent without admin approval.

## 2. Customer Portal Transparency

- Keep portal activity visible for every meaningful setup or lead event.
- Use plain-English labels: Call Activity, Text Follow-up, Lead Pipeline, Booking Flow, Lead Review.
- Make customer controls available through Action Center instead of outside apps.
- Show daily/instant/weekly update preferences in the portal.
- Keep sensitive call transcripts, payment details, health data, and private customer details out of customer-facing summaries unless reviewed.

## 3. Compliance And Audit Readiness

- Confirm Twilio credentials are present in Render before live SMS sending.
- Verify toll-free sender, inbound webhook, status callback, STOP, HELP, and consent proof.
- Review TCPA/SMS consent, do-not-contact, quiet hours, AI disclosure, privacy requests, and data minimization.
- Use Legal Audit AI as a review queue, not as legal advice or automatic approval.
- Keep approved legal/compliance pages linked from every public page.

## 4. Reviews And Public Proof

- Remove all fake/static testimonials.
- Add reviews only after a real signed-up customer has used the service and given permission.
- Keep new reviews pending until the owner approves them in the admin dashboard.
- Use outcome summaries only when they are truthful and supported by account activity.

## 5. Data And Reporting

- Confirm every active account has metrics for calls helped, texts sent, leads tracked, recovered calls, and estimated recovered value.
- Generate daily reports in the admin dashboard.
- Use weekly/monthly summaries for customers who prefer fewer updates.
- Keep report claims conservative: estimated, tracked, assisted, recovered, reviewed.

## 6. Manual Support Queue

- Items that still need manual support should stay visible in the Admin Daily Ops Report.
- Common manual items: missing API keys, Twilio credentials, unresolved legal audits, billing issues, customer action requests, unanswered support questions, calendar connection approvals.
- If an item blocks customer-facing automation, mark the account `needs_attention`.

## 7. Demo Account Readiness

- Keep `demo@autovyne.com` refreshed with realistic portal activity.
- Use the demo account during cold calls so prospects see the portal instead of hearing technical app names.
- Do not place real customer data in the demo account.

## 8. Cold Calling And Outreach Scripts

- Do these after the product, compliance, and demo flow are verified.
- Build scripts around the customer's pain: missed calls, slow follow-up, lost bookings, unclear lead tracking.
- Avoid guaranteed revenue claims.
- End with a simple offer: audit, demo portal walkthrough, or signup.

