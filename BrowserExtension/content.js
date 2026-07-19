function passwordFields() {
  return [...document.querySelectorAll('input[type="password"]')].filter(input => !input.disabled && input.offsetParent !== null);
}

function usernameField(passwordField) {
  const form = passwordField.closest('form') || document;
  const candidates = [...form.querySelectorAll('input:not([type="hidden"]):not([type="password"])')];
  return candidates.find(input => /email|user|login|account/i.test(`${input.name} ${input.id} ${input.autocomplete}`)) || candidates[0];
}

function setValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
}

function fill(entry) {
  const field = passwordFields()[0];
  if (!field) throw new Error('No password field was found on this page.');
  const user = usernameField(field);
  if (user) setValue(user, entry.username);
  setValue(field, entry.password);
}

chrome.runtime.onMessage.addListener((message, _, respond) => {
  if (message.type === 'fillFields') {
    try { fill(message.entry); respond({ ok: true }); }
    catch (error) { respond({ ok: false, error: error.message }); }
  }
});

async function autofillSingleCredential() {
  if (!passwordFields().length) return;
  const response = await chrome.runtime.sendMessage({ type: 'getCredentials', url: location.href });
  if (response.ok && !response.locked && response.entries.length === 1) {
    // Ask the background for the private value only after a matching credential is selected.
    chrome.runtime.sendMessage({ type: 'fillCredential', id: response.entries[0].id });
  }
}

document.addEventListener('submit', event => {
  const form = event.target;
  const password = form.querySelector('input[type="password"]');
  if (!password || password.autocomplete === 'new-password') return;
  const user = usernameField(password);
  if (!user || !user.value || !password.value) return;
  chrome.runtime.sendMessage({
    type: 'saveCredential',
    url: location.href,
    username: user.value,
    password: password.value,
    name: document.title
  });
}, true);

// Autofill only unambiguous matches. Use the popup to choose between multiple accounts.
autofillSingleCredential().catch(() => {});
