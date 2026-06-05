const fs = require('fs');
const vm = require('vm');

const template = fs.readFileSync('views/demo.ejs', 'utf8');
const inlineScripts = [...template.matchAll(/<script>([\s\S]*?)<\/script>/g)];

if (inlineScripts.length !== 1) {
  throw new Error(`Expected one inline demo script, found ${inlineScripts.length}`);
}

const elements = new Map();
const chartRects = [];
const noop = () => {};
const chartContext = {
  scale: noop, clearRect: noop, fillText: noop, beginPath: noop,
  moveTo: noop, lineTo: noop, stroke: noop,
  fillRect(...args) { chartRects.push({ color: this.fillStyle, args }); },
};
const ranges = {
  'slider-leads': ['1', '1000', '60'],
  'slider-ticket': ['1', '50000', '250'],
  'slider-missed': ['0', '95', '25'],
  'slider-conversion': ['1', '95', '20'],
  'scrubber-input': ['0', '12', '0'],
};

function element(id = '') {
  if (elements.has(id)) return elements.get(id);
  const node = {
    id, style: {}, className: '', textContent: '', innerHTML: '',
    value: '', min: '0', max: '100',
    classList: { add: noop, remove: noop, toggle: noop },
    addEventListener: noop, remove: noop, scrollIntoView: noop, insertBefore: noop,
    querySelector: () => element(`${id}:child`), querySelectorAll: () => [],
    getBoundingClientRect: () => ({ width: 900, height: 220 }),
    getContext: () => chartContext,
  };
  if (ranges[id]) [node.min, node.max, node.value] = ranges[id];
  if (id === 'industry-select') node.value = 'hvac';
  elements.set(id, node);
  return node;
}

const sandbox = {
  console, URLSearchParams, Math, Number, Date,
  performance: { now: () => 0 },
  location: { search: '?leads=NaN&ticket=Infinity&missed=-500&conversion=999999' },
  document: {
    getElementById: element, querySelector: () => element('chart-wrap'),
    querySelectorAll: () => [], createElement: () => element('created'),
    addEventListener: noop,
  },
  requestAnimationFrame(callback) { callback(); return 1; },
  cancelAnimationFrame: noop,
  setTimeout(callback) { callback(); },
  ResizeObserver: class {
    constructor(callback) { this.callback = callback; }
    observe() { this.callback(); }
  },
};
sandbox.window = sandbox;
sandbox.window.devicePixelRatio = 1;
sandbox.window.addEventListener = noop;

vm.createContext(sandbox);
vm.runInContext(inlineScripts[0][1], sandbox);
vm.runInContext('leads=NaN; ticket=Infinity; missed=-1; conversion=999; updateKPIs(); drawChart();', sandbox);

const kpiIds = ['kpi-risk', 'kpi-recovered', 'kpi-cost', 'kpi-savings', 'kpi-roi', 'tracker-without', 'tracker-with'];
for (const id of kpiIds) {
  const output = element(id).textContent;
  if (/NaN|Infinity|N\/A/.test(output)) throw new Error(`${id} contains unsafe output: ${output}`);
}
for (const rect of chartRects) {
  if (rect.args.some((value) => !Number.isFinite(value))) throw new Error('Chart received non-finite geometry');
}

const bars = chartRects.filter(({ color }) => color === '#ef4444' || color === '#22c55e');
for (let index = 0; index < bars.length; index += 2) {
  if (bars[index + 1] && bars[index + 1].args[3] < bars[index].args[3]) {
    throw new Error('With-AI projection bar is lower than the without-AI bar');
  }
}

console.log('Simulator smoke test passed.');
console.log(kpiIds.map((id) => `${id}=${element(id).textContent}`).join(' | '));
console.log(`${bars.length} chart bars rendered with finite geometry.`);
