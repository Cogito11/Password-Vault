const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

function load() {
  const read = (p) => fs.readFileSync(path.join(__dirname, '..', 'PasswordVault/javascript', p), 'utf8');
  const sandbox = { console };
  vm.createContext(sandbox);
  vm.runInContext(read('core/utils.js'), sandbox);
  vm.runInContext(read('storage/vault-io.js'), sandbox);
  return sandbox;
}

const { buildFileText, parseFile } = load();

// The parser as it was before the format fix, used to prove existing files still read the same
function oldParseFile(text) {
  const entries = [];
  const lines = text.split(/\r?\n/);
  let cur = null;
  for (const raw of lines) {
    const tr = raw.trim();
    if (!tr || /^end$/i.test(tr) || /^[-=]/.test(tr)) continue;
    if (/^\s/.test(raw) && cur) {
      const ci = tr.indexOf(':');
      if (ci > 0) cur.attrs.push({ key: tr.slice(0, ci).trim(), val: tr.slice(ci + 1).trim() });
      continue;
    }
    cur = { name: tr.replace(/\s*\(\d+\s*(?:attributes?)?\)\s*$/i, '').trim(), attrs: [] };
    if (cur.name) entries.push(cur);
  }
  return entries;
}

const plain = (x) => JSON.parse(JSON.stringify(x));
const roundTrip = (entries) => plain(parseFile(buildFileText(entries)));
const entry = (name, ...attrs) => ({ name, attrs: attrs.map(([key, val]) => ({ key, val })) });

// ---------- the cases that used to corrupt data ----------

test('entry names starting with "-" or "=" survive', () => {
  for (const name of ['-Backup account', '=Bank', '- spaced', '-', '=', '--two', '==two']) {
    const e = [entry(name, ['Password', 'a'])];
    assert.deepEqual(roundTrip(e), e, name);
  }
});

test('attribute keys starting with "-" or "=" survive', () => {
  const e = [entry('Site', ['-pin', '1234'], ['=note', 'x'])];
  assert.deepEqual(roundTrip(e), e);
});

test('attribute keys containing colons survive', () => {
  const e = [entry('Site', ['Security Q: pet', 'rex'], ['a:b:c', 'v'], [':', 'x'], ['trailing:', 'y'])];
  assert.deepEqual(roundTrip(e), e);
});

test('attribute keys containing backslashes survive', () => {
  const e = [entry('Site', ['C:\\Users\\me', 'v'], ['ends with\\', 'v2'], ['\\:', 'v3'], ['\\\\', 'v4'])];
  assert.deepEqual(roundTrip(e), e);
});

test('values keep leading and trailing spaces exactly', () => {
  const e = [entry('Site', ['Password', 'abc '], ['Password', ' abc'], ['Password', '  both  '], ['Password', ' '])];
  assert.deepEqual(roundTrip(e), e);
});

test('empty values survive', () => {
  const e = [entry('Site', ['Note', ''], ['Password', 'x'])];
  assert.deepEqual(roundTrip(e), e);
});

test('values containing colons, equals, dashes and backslashes survive', () => {
  const e = [entry('Site', ['URL', 'https://example.com:8080/a?b=c'], ['Password', '-abc==:\\x\\'], ['Note', 'End'], ['Note', '--- ---'])];
  assert.deepEqual(roundTrip(e), e);
});

test('multi-line values (e.g. CSV notes) stay in ONE attribute', () => {
  const e = [entry('Site', ['Note', 'line1\nline2\nline3'], ['Password', 'pw'])];
  const back = roundTrip(e);
  assert.deepEqual(back, e);
  assert.equal(back.length, 1, 'no bogus extra entries');
});

test('multi-line values with blank lines, indentation and tricky text survive', () => {
  const e = [entry('Site', ['Note', 'first\n\nthird after a blank\n   indented\nEnd\n--- dashes\n- item\nKey: not a key'], ['Password', 'pw'])];
  assert.deepEqual(roundTrip(e), e);
});

test('a value that starts with a line break survives', () => {
  const e = [entry('Site', ['Note', '\nsecond line'])];
  assert.deepEqual(roundTrip(e), e);
});

test('blank lines inside a value survive even if an editor strips trailing whitespace', () => {
  const e = [entry('Site', ['Note', 'a\n\n\nb'], ['Password', 'pw'])];
  const text = buildFileText(e).split('\n').map((l) => l.replace(/\s+$/, '')).join('\n');
  assert.deepEqual(plain(parseFile(text)), e);
});

test('names and keys are kept to one line', () => {
  const back = roundTrip([entry('Two\nLines', ['Key\r\nName', 'v'])]);
  assert.equal(back[0].name, 'Two Lines');
  assert.equal(back[0].attrs[0].key, 'Key Name');
});

test('names that end like the "(N attributes)" annotation keep it', () => {
  for (const name of ['Gmail (2)', 'Room (3 attributes)', 'Plan (B)', '(1)x']) {
    const e = [entry(name, ['U', 'x'])];
    assert.deepEqual(roundTrip(e), e, name);
  }
});

test('unicode and emoji survive', () => {
  const e = [entry('Банк 银行 Café 😀', ['Пароль', 'pässwörd-🔑'], ['密码', '日本語'])];
  assert.deepEqual(roundTrip(e), e);
});

test('entries with no attributes and many entries survive in order', () => {
  const e = [entry('Empty'), entry('One', ['k', 'v']), entry('Empty2'), entry('Three', ['a', '1'], ['b', '2'], ['c', '3'])];
  assert.deepEqual(roundTrip(e), e);
});

test('an empty collection round-trips', () => {
  assert.deepEqual(roundTrip([]), []);
});

test('Windows line endings are read correctly', () => {
  const e = [entry('Site', ['Password', 'pw'], ['Note', 'a\nb'])];
  const text = buildFileText(e).replace(/\n/g, '\r\n');
  assert.deepEqual(plain(parseFile(text)), e);
});

// ---------- existing files must keep reading the same ----------

test('the writer produces exactly the same text as before for ordinary data', () => {
  const e = [entry('GitHub', ['Username', 'cole'], ['Password', 'hunter2']), entry('Reddit', ['Username', 'somebody'])];
  assert.equal(
    buildFileText(e),
    'GitHub (2 attributes)\n    Username: cole\n    Password: hunter2\n\nReddit (1 attributes)\n    Username: somebody\n\nEnd'
  );
});

test('files written by the previous version parse exactly as before', () => {
  const corpus = [
    'GitHub (3)\n  Username: cole11\n  Password: hunter2-hunter2\n  URL: https://github.com\nReddit (2)\n  Username: somebody\n  Password: correct-horse\n',
    'GitHub (2 attributes)\n    Username: cole\n    Password: hunter2\n\nReddit (1 attributes)\n    Username: x\n\nEnd',
    '\ufeffFirst (1 attributes)\n    Key: Value\n\nEnd',
    'Tabbed (2 attributes)\n\tUser: a\n\tPass: b\n\nEnd',
    'Mixed Case (1 attributes)\n    kEy: VaLuE with: colons: in it\n\nEnd',
    '----------\nSection A (1 attributes)\n    K: v\n==========\nSection B (1 attributes)\n    K2: v2\nEnd',
    'No Annotation\n    K: v\n\nAnother\n    K: v\n'
  ];
  for (const text of corpus) assert.deepEqual(plain(parseFile(text)), plain(oldParseFile(text)), text.slice(0, 30));
});

test('hand-edited extras are still tolerated: separators, End, blank lines, CRLF', () => {
  const text = '=====\r\nA (1 attributes)\r\n    k: v\r\n\r\n-----\r\n\r\nB (1 attributes)\r\n    k2: v2\r\nEnd\r\n';
  assert.deepEqual(plain(parseFile(text)), [entry('A', ['k', 'v']), entry('B', ['k2', 'v2'])]);
});

test('a line with no colon inside an entry is ignored, not turned into an entry', () => {
  const back = plain(parseFile('A (1 attributes)\n    k: v\n    just some text\nB (0 attributes)\n'));
  assert.equal(back.length, 2);
  assert.equal(back[0].name, 'A');
});

test('legacy key ending in a backslash is not lost', () => {
  const back = plain(parseFile('A (1 attributes)\n    Dir\\: value\n'));
  assert.deepEqual(back[0].attrs, [{ key: 'Dir\\', val: 'value' }]);
});

// ---------- fuzz: random tricky data must always round-trip ----------

function rng(seed) {
  let s = seed >>> 0;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

const ALPHABET = ['a', 'B', '7', ' ', ' ', '-', '=', ':', ':', '\\', '(', ')', '"', "'", '#', '*', '.', 'é', '银', '😀', 'End', '---', ': ', ' (2)', '(3 attributes)', '\t'];

function randomText(r, maxLen, allowNewlines) {
  let out = '';
  const n = Math.floor(r() * maxLen);
  for (let i = 0; i < n; i++) {
    if (allowNewlines && r() < 0.08) out += r() < 0.5 ? '\n' : '\r\n';
    else out += ALPHABET[Math.floor(r() * ALPHABET.length)];
  }
  return out;
}

// What a round trip is expected to produce: names/keys on one trimmed line,
// values with normalised line breaks and no trailing blank lines (after the first line)
function expected(e) {
  const one = (s) => s.replace(/[\r\n]+/g, ' ').trim();
  return {
    name: one(e.name),
    attrs: e.attrs.map((a) => {
      let val = a.val.replace(/\r\n|\r/g, '\n');
      // The one documented limit: blank (or whitespace-only) lines at the END of a
      // multi-line value can't be told apart from the gap before the next entry
      if (val.includes('\n')) val = val.replace(/(\n\s*)+$/, '');
      return { key: one(a.key), val };
    })
  };
}

test('fuzz: 4000 random collections of hostile entries round-trip exactly', () => {
  const r = rng(12345);
  let checked = 0;

  for (let round = 0; round < 4000; round++) {
    const entries = [];
    const count = 1 + Math.floor(r() * 4);

    for (let i = 0; i < count; i++) {
      const name = randomText(r, 14, false).trim() || 'Entry';
      const attrs = [];
      const attrCount = Math.floor(r() * 4);
      for (let j = 0; j < attrCount; j++) {
        const key = randomText(r, 10, false).trim() || 'K';
        attrs.push({ key, val: randomText(r, 24, true) });
      }
      entries.push({ name, attrs });
    }

    // Skip the one documented limit: a name that is nothing but the annotation
    const want = entries.map(expected);
    const got = plain(parseFile(buildFileText(entries)));

    assert.deepEqual(got, want, 'input: ' + JSON.stringify(entries));
    checked++;
  }

  assert.equal(checked, 4000);
});
