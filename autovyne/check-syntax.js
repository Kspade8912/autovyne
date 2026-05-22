const fs = require('fs');
const content = fs.readFileSync('views/simulator.ejs', 'utf8');

// Find the main script block (last <script> tag)
const lastScriptStart = content.lastIndexOf('<script>');
const lastScriptEnd = content.indexOf('</script>', lastScriptStart);
if (lastScriptStart === -1 || lastScriptEnd === -1) {
  console.error('No script block found');
  process.exit(1);
}
const js = content.substring(lastScriptStart + 8, lastScriptEnd).trim();

// Validate JS syntax
try {
  new Function(js);
  console.log('simulator.ejs JS syntax: OK');
} catch(e) {
  console.error('JS SYNTAX ERROR:', e.message);
  process.exit(1);
}

// Check key sections
const checks = [
  ['drawChart has canvas null check', js.includes('if (!canvas)')],
  ['drawChart has rect zero-dim check', js.includes('rect.width === 0')],
  ['updateSim has try/catch', js.includes('try {') && js.includes('} catch (e) {')],
  ['error logging present', js.includes('console.error')],
  ['additionalAnnual returned from simulate', js.includes('additionalAnnual')],
  ['at-risk uses separate atRisk calc', js.includes('const atRisk = leads')],
];

let passed = 0;
let failed = 0;
for (const [name, result] of checks) {
  if (result) { console.log('  PASS:', name); passed++; }
  else        { console.log('  FAIL:', name); failed++; }
}

console.log('\n' + passed + '/' + (passed + failed) + ' checks passed');
if (failed > 0) process.exit(1);