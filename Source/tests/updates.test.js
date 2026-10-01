const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function loadUpdates(fetchImpl) {
  const fullPath = path.join(__dirname, '..', 'PasswordVault/javascript/core/updates.js');
  const source = fs.readFileSync(fullPath, 'utf8');
  const sandbox = { console, fetch: fetchImpl };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox);
  return sandbox;
}

function response(status, body, headers = {}) {
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: { get: (name) => headers[name] ?? null },
    json: async () => body
  };
}

test('isNewerVersion compares dot-separated numbers numerically', () => {
  const { isNewerVersion } = loadUpdates();
  assert.equal(isNewerVersion('1.3.2', '1.3.1'), true);
  assert.equal(isNewerVersion('1.10.0', '1.9.9'), true);
  assert.equal(isNewerVersion('2.0', '1.9.9'), true);
  assert.equal(isNewerVersion('1.3.1', '1.3.1'), false);
  assert.equal(isNewerVersion('1.3.0', '1.3.1'), false);
  assert.equal(isNewerVersion('1.3', '1.3.0'), false);
});

test('isNewerVersion never claims an update it cannot verify', () => {
  const { isNewerVersion } = loadUpdates();
  assert.equal(isNewerVersion('', '1.0.0'), false);
  assert.equal(isNewerVersion('1.0.0', ''), false);
  assert.equal(isNewerVersion('1.0.0', 'unknown'), false);
  assert.equal(isNewerVersion(undefined, undefined), false);
});

test('checkForUpdate reports a newer release and strips the leading v', async () => {
  let requested;
  const { checkForUpdate } = loadUpdates(async (url) => {
    requested = url;
    return response(200, { tag_name: 'v1.4.0', published_at: '2026-01-01T00:00:00Z' });
  });

  const result = await checkForUpdate('1.3.1');
  assert.equal(requested, 'https://api.github.com/repos/Cogito11/Password-Vault/releases/latest');
  assert.deepEqual({ ...result }, { hasUpdate: true, latestVersion: '1.4.0', publishedAt: '2026-01-01T00:00:00Z' });
});

test('checkForUpdate reports up to date when versions match', async () => {
  const { checkForUpdate } = loadUpdates(async () => response(200, { tag_name: 'v1.3.1' }));
  const result = await checkForUpdate('1.3.1');
  assert.equal(result.hasUpdate, false);
  assert.equal(result.latestVersion, '1.3.1');
});

test('checkForUpdate maps failures to specific reasons', async () => {
  const cases = [
    [() => response(404, {}), 'no-release'],
    [() => response(403, {}, { 'X-RateLimit-Remaining': '0' }), 'rate-limited'],
    [() => response(429, {}), 'rate-limited'],
    [() => response(403, {}, { 'X-RateLimit-Remaining': '42' }), 'fetch-failed'],
    [() => response(500, {}), 'fetch-failed'],
    [() => { throw new TypeError('offline'); }, 'fetch-failed']
  ];

  for (const [impl, reason] of cases) {
    const { checkForUpdate } = loadUpdates(async () => impl());
    await assert.rejects(() => checkForUpdate('1.0.0'), { message: reason });
  }
});
