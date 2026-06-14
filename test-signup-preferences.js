const assert = require('assert');
const fs = require('fs');
const path = require('path');

const signupView = fs.readFileSync(path.join(__dirname, 'views', 'signup.ejs'), 'utf8');
const signupStatusView = fs.readFileSync(path.join(__dirname, 'views', 'signup-status.ejs'), 'utf8');

assert(signupView.includes('Optional Consultation Builder'), 'Signup should include the consultation builder.');
assert(signupView.includes('name="service_needs"'), 'Signup should collect selected business needs.');
assert(signupView.includes('name="update_channels"'), 'Signup should collect owner update channels.');
assert(signupView.includes('name="booking_channels"'), 'Signup should collect booking update channels.');
assert(signupView.includes('name="calendar_provider"'), 'Signup should collect calendar preference.');
assert(signupView.includes('name="followup_style"'), 'Signup should collect follow-up style.');
assert(signupView.includes('signup-recommendation'), 'Signup should show a recommendation preview.');
assert(signupStatusView.includes('Your setup recommendation'), 'Signup status should show the saved recommendation.');

console.log('Signup preference UI smoke test passed.');
