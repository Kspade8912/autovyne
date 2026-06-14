const assert = require('assert');
const fs = require('fs');
const path = require('path');

const tutorialView = fs.readFileSync(path.join(__dirname, 'views', 'tutorial.ejs'), 'utf8');
const gifPath = path.join(__dirname, 'public', 'media', 'autovyne-demo-walkthrough.gif');

assert(fs.existsSync(gifPath), 'Tutorial walkthrough GIF is missing.');
assert(fs.statSync(gifPath).size > 100000, 'Tutorial walkthrough GIF looks too small to be valid.');
assert(tutorialView.includes('/media/autovyne-demo-walkthrough.gif'), 'Tutorial page does not embed walkthrough asset.');
assert(tutorialView.includes('demo@autovyne.com'), 'Tutorial page should include demo account email.');
assert(tutorialView.includes('AutovyneDemo2026!'), 'Tutorial page should include demo account access code.');
assert(tutorialView.includes('Narration transcript'), 'Tutorial page should include narration transcript.');

console.log('Tutorial asset smoke test passed.');
