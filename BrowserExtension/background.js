const NATIVE_HOST = 'com.cogito11.password_vault';
let nativePort = null;
let nextRequestId = 0;
const pending = new Map();
let cachedEntries = [];
let activeBookId = null;

function nativeRequest(payload) {
  if (!nativePort) {
    nativePort = chrome.runtime.connectNative(NATIVE_HOST);
    nativePort.onMessage.addListener(response => {
      const request = pending.get(response.requestId);
      if (!request) return;
      pending.delete(response.requestId);
      response.ok ? request.resolve(response) : request.reject(new Error(response.error || 'Password Vault request failed.'));
    });
    nativePort.onDisconnect.addListener(() => {
      const error = new Error(chrome.runtime.lastError && chrome.runtime.lastError.message || 'Password Vault companion is unavailable.');
      pending.forEach(request => request.reject(error));
      pending.clear(); nativePort = null; cachedEntries = [];
    });
  }
  return new Promise((resolve, reject) => {
    const requestId = ++nextRequestId;
    pending.set(requestId, { resolve, reject });
    nativePort.postMessage({ ...payload, requestId });
  });
}

function publicEntry(entry) {
  return { id: entry.id, name: entry.name, origin: entry.origin, username: entry.username };
}

async function loadCredentials(url) {
  if (!activeBookId) return { locked: false, entries: [] };
  const response = await nativeRequest({ type: 'getBookEntries', bookId: activeBookId });
  cachedEntries = response.entries;
  return { ...response, entries: response.entries.filter(entry => entry.origin === new URL(url).origin) };
}

function password(length = 20) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=';
  const values = crypto.getRandomValues(new Uint32Array(length));
  return Array.from(values, value => alphabet[value % alphabet.length]).join('');
}

chrome.runtime.onMessage.addListener((message, sender, respond) => {
  (async () => {
    if (message.type === 'status') return respond(await nativeRequest({ type: 'status' }));
    if (message.type === 'listBooks') return respond(await nativeRequest({ type: 'listBooks' }));
    if (message.type === 'selectBook') { activeBookId = message.bookId; return respond({ ok: true }); }
    if (message.type === 'unlockBook') return respond(await nativeRequest({ type: 'unlockBook', bookId: message.bookId, password: message.password || '' }));
    if (message.type === 'lockVault') return respond(await nativeRequest({ type: 'lock' }));
    if (message.type === 'generatePassword') return respond({ ok: true, password: password(message.length) });

    if (message.type === 'getCredentials') {
      const result = await loadCredentials(message.url);
      return respond({ ok: true, locked: result.locked, entries: result.entries.map(publicEntry) });
    }

    if (message.type === 'getBookEntries') {
      const result = await nativeRequest({ type: 'getBookEntries', bookId: message.bookId });
      cachedEntries = result.entries;
      return respond(result);
    }

    if (message.type === 'fillCredential') {
      const entry = cachedEntries.find(item => item.id === message.id);
      if (!entry) throw new Error('Refresh the extension and choose a login again.');
      const tabId = message.tabId || (sender.tab && sender.tab.id);
      if (!tabId) throw new Error('Open a website tab before filling a login.');
      let fillResult;
      try {
        fillResult = await chrome.tabs.sendMessage(tabId, { type: 'fillFields', entry });
      } catch (error) {
        // Chrome throws "Could not establish connection. Receiving end does not exist."
        // when the content script isn't present on this tab — e.g. a chrome:// page,
        // the new-tab page, a PDF viewer, or a tab left open from before the extension
        // was installed or reloaded.
        throw new Error('Can\u2019t fill this page. Try reloading the page, or make sure it\u2019s a regular website tab.');
      }
      if (!fillResult || !fillResult.ok) throw new Error(fillResult && fillResult.error || 'Could not fill this page.');
      return respond({ ok: true });
    }

    if (message.type === 'saveCredential') {
      const result = await nativeRequest({ type: 'saveCredential', ...message, bookId: activeBookId });
      return respond(result);
    }

    if (message.type === 'saveEntries') {
      const result = await nativeRequest({ type: 'saveCredential', ...message.entry, bookId: activeBookId });
      return respond(result);
    }
    throw new Error('Unknown request.');
  })().catch(error => respond({ ok: false, error: error.message || 'Password Vault could not complete that request.' }));
  return true;
});
