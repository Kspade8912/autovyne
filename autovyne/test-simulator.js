const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.connectOverCDP('wss://connect.anchorbrowser.io/?sessionId=4537ae0f-5204-49b8-85a1-d4a1b19a48de');
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1280, height: 720 });

  // Collect console errors
  const errors = [];
  page.on('console', msg => { if (msg.type() === 'error') errors.push(msg.text()); });

  await page.goto('https://autovyne.polsia.app/simulator', { waitUntil: 'networkidle', timeout: 15000 });

  // Check initial chart state
  const chartCanvas = await page.$('#projectionChart');
  const canvasBox = await chartCanvas.boundingBox();
  console.log('Canvas initial box:', JSON.stringify(canvasBox));

  // Get initial KPI values
  const kpiAtRisk = await page.textContent('#kpi-at-risk');
  const kpiAdditional = await page.textContent('#kpi-additional');
  const kpiCost = await page.textContent('#kpi-cost');
  console.log('Initial KPIs — at-risk:', kpiAtRisk, '| additional:', kpiAdditional, '| cost:', kpiCost);

  // Change leads input
  await page.fill('#f-leads', '200');
  await page.waitForTimeout(600);

  const kpiAtRiskAfter = await page.textContent('#kpi-at-risk');
  const kpiAdditionalAfter = await page.textContent('#kpi-additional');
  console.log('After leads=200 — at-risk:', kpiAtRiskAfter, '| additional:', kpiAdditionalAfter);
  console.log('Changed?', kpiAtRisk !== kpiAtRiskAfter ? 'YES (working)' : 'NO (BUG — values not updating!)');

  // Change ticket value
  await page.fill('#f-ticket', '500');
  await page.waitForTimeout(600);
  const kpiAtRiskAfter2 = await page.textContent('#kpi-at-risk');
  console.log('After ticket=500 — at-risk:', kpiAtRiskAfter2);
  console.log('Changed?', kpiAtRiskAfter !== kpiAtRiskAfter2 ? 'YES (working)' : 'NO (BUG)');

  // Check table update
  const firstRowText = await page.textContent('tr:first-child td:nth-child(2)');
  console.log('Table first row (Without Autovyne):', firstRowText);

  console.log('\nConsole errors:', errors.length === 0 ? 'NONE' : errors);

  await browser.close();
  console.log('\nDone.');
})().catch(e => { console.error('Error:', e.message); process.exit(1); });