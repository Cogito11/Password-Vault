const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadSidebarResize() {
  const fullPath = path.join(__dirname, '..', 'PasswordVault/javascript/ui/sidebar-resize.js');
  const source = fs.readFileSync(fullPath, 'utf8');
  // No sidebar elements exist here, so the DOM wiring is skipped and only the
  // pure helper and constants are exercised.
  const sandbox = { console, document: { getElementById: () => null, querySelector: () => null } };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

test('default width sits between the min and max', () => {
  const { SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } = loadSidebarResize();
  assert.ok(SIDEBAR_MIN_WIDTH < 300 && 300 < SIDEBAR_MAX_WIDTH);
});

test('clampSidebarWidth enforces the min and max on a roomy window', () => {
  const { clampSidebarWidth } = loadSidebarResize();
  assert.equal(clampSidebarWidth(100, 1600), 250);
  assert.equal(clampSidebarWidth(250, 1600), 250);
  assert.equal(clampSidebarWidth(300, 1600), 300);
  assert.equal(clampSidebarWidth(400, 1600), 400);
  assert.equal(clampSidebarWidth(900, 1600), 400);
});

test('clampSidebarWidth rounds to whole pixels', () => {
  const { clampSidebarWidth } = loadSidebarResize();
  assert.equal(clampSidebarWidth(300.6, 1600), 301);
});

test('the max shrinks on small windows so the main view keeps its room', () => {
  const { clampSidebarWidth } = loadSidebarResize();
  // 900 wide window -> sidebar can be at most 900 - 400 = 500, so the static max (400) wins
  assert.equal(clampSidebarWidth(900, 900), 400);
  // 800 wide window -> at most 400
  assert.equal(clampSidebarWidth(500, 800), 400);
  // 700 wide window -> at most 300
  assert.equal(clampSidebarWidth(500, 700), 300);
  // never goes below the min, even on a tiny window
  assert.equal(clampSidebarWidth(500, 500), 250);
});

test('without a known window width only the static limits apply', () => {
  const { clampSidebarWidth } = loadSidebarResize();
  assert.equal(clampSidebarWidth(500), 400);
  assert.equal(clampSidebarWidth(10), 250);
});
