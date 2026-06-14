const assert = require('assert');
const fs = require('fs');
const path = require('path');

const portalView = fs.readFileSync(path.join(__dirname, 'views', 'portal.ejs'), 'utf8');
const themeCss = fs.readFileSync(path.join(__dirname, 'public', 'css', 'theme.css'), 'utf8');

assert(
  portalView.includes("if (!authorized)") && portalView.includes("include('partials/nav')"),
  'Portal login should keep the public navigation for unauthenticated visitors.'
);

assert(
  portalView.includes('portal-app-nav') && portalView.includes('portal-app-footer'),
  'Logged-in portal should use compact app navigation and footer.'
);

assert(
  !portalView.includes(`<%- include('partials/footer') %>\n  <% if (authorized)`),
  'Logged-in portal should not render the public marketing footer.'
);

assert(themeCss.includes('.portal-app-body'), 'Portal app body styling is missing.');
assert(themeCss.includes('.portal-app-nav'), 'Portal app navigation styling is missing.');
assert(themeCss.includes('.portal-shell-app'), 'Compact portal shell styling is missing.');

console.log('Portal UI smoke test passed.');
