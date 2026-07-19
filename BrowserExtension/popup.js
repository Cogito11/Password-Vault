const $ = selector => document.querySelector(selector);
let activeTab; let selectedBook; let bookEntries = [];
function send(message) { return chrome.runtime.sendMessage(message).then(response => { if (!response || !response.ok) throw new Error(response && response.error || 'Request failed.'); return response; }); }
function message(text) { $('#message').textContent = text; }
async function currentTab() { [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true }); const url = new URL(activeTab.url); $('#siteLabel').textContent = url.hostname; $('#entryUrl').value = url.origin; }
function showBooks() { $('#bookView').hidden = false; $('#unlockView').hidden = true; $('#vaultView').hidden = true; }
async function loadBooks() { const result = await send({ type: 'listBooks' }); const list = $('#bookList'); list.replaceChildren(); result.books.forEach(book => { const row = document.createElement('button'); row.className = 'book'; row.innerHTML = '<span></span><small></small>'; row.querySelector('span').textContent = book.name; row.querySelector('small').textContent = book.encrypted && !book.unlocked ? 'Locked' : book.encrypted ? 'Encrypted' : 'Open'; row.onclick = () => selectBook(book); list.append(row); }); showBooks(); }
function showUnlock() { $('#bookView').hidden = true; $('#unlockView').hidden = false; $('#vaultView').hidden = true; $('#unlockTitle').textContent = 'Unlock ' + selectedBook.name; $('#masterPassword').value = ''; $('#masterPassword').focus(); }
async function selectBook(book) { selectedBook = book; await send({ type: 'selectBook', bookId: book.id }); await loadBook(); }
async function copyText(button, text) {
  try {
    await navigator.clipboard.writeText(text);
    const original = button.textContent;
    button.textContent = 'Copied';
    button.disabled = true;
    setTimeout(() => { button.textContent = original; button.disabled = false; }, 1200);
  } catch (_) {
    message('Could not copy to clipboard.');
  }
}
function makeEntry(entry) {
  const row = document.createElement('div'); row.className = 'entry';
  const name = document.createElement('div'); name.className = 'entry-name'; name.textContent = entry.name; row.append(name);
  (entry.attributes || []).forEach(attribute => {
    const attr = document.createElement('div'); attr.className = 'entry-attr';
    const key = document.createElement('span'); key.className = 'attr-key'; key.textContent = attribute.key;
    const val = document.createElement('span'); val.className = 'attr-val'; val.textContent = attribute.val;
    // The displayed password is masked for security, but Copy should still put the real
    // value on the clipboard rather than the bullet characters shown on screen.
    const isPassword = /^(password|pass|pwd)$/i.test(attribute.key);
    const copyValue = isPassword ? entry.password : attribute.val;
    const copy = document.createElement('button'); copy.type = 'button'; copy.className = 'copy-button'; copy.textContent = 'Copy'; copy.title = 'Copy ' + attribute.key;
    copy.onclick = () => copyText(copy, copyValue);
    attr.append(key, val, copy); row.append(attr);
  });
  const fill = document.createElement('button'); fill.className = 'fill-button'; fill.textContent = 'Fill'; fill.title = 'Fill this login into the current page'; fill.onclick = () => fillEntry(entry.id);
  row.append(fill);
  return row;
}
function attributeSearchText(entry) { return (entry.attributes || []).map(attribute => attribute.key + ' ' + attribute.val).join(' '); }
function renderBook() { const site = new URL(activeTab.url).origin; const matches = bookEntries.filter(entry => entry.origin === site); const query = $('#searchPasswords').value.trim().toLowerCase(); const allEntries = query ? bookEntries.filter(entry => (entry.name + ' ' + entry.username + ' ' + entry.origin + ' ' + attributeSearchText(entry)).toLowerCase().includes(query)) : bookEntries; const all = $('#entryList'); const matchList = $('#matchList'); all.replaceChildren(); matchList.replaceChildren(); matches.forEach(entry => matchList.append(makeEntry(entry))); allEntries.forEach(entry => all.append(makeEntry(entry))); $('#emptyMatches').hidden = matches.length > 0; $('#fillFirst').hidden = matches.length === 0; $('#matchesHeading').textContent = 'This website (' + matches.length + ')'; }
async function loadBook() { const result = await send({ type: 'getBookEntries', bookId: selectedBook.id }); if (selectedBook.encrypted === true && result.locked === true) { showUnlock(); return; } bookEntries = result.entries || []; $('#bookTitle').textContent = selectedBook.name; $('#bookView').hidden = true; $('#unlockView').hidden = true; $('#vaultView').hidden = false; $('#lockButton').hidden = false; renderBook(); }
async function fillEntry(id) { try { await send({ type: 'fillCredential', id, tabId: activeTab.id }); message('Login filled.'); } catch (error) { message(error.message); } }
$('#unlockButton').onclick = async () => { try { await send({ type: 'unlockBook', bookId: selectedBook.id, password: $('#masterPassword').value }); selectedBook.unlocked = true; await loadBook(); } catch (_) { message('Incorrect password or unreadable book.'); } };
$('#masterPassword').onkeydown = event => { if (event.key === 'Enter') $('#unlockButton').click(); };
$('#backToBooks').onclick = () => loadBooks().catch(error => message(error.message));
$('#lockButton').onclick = async () => { try { await send({ type: 'lockVault' }); await loadBooks(); } catch (error) { message(error.message); } };
$('#addToggle').onclick = () => { $('#entryForm').hidden = !$('#entryForm').hidden; };
$('#generate').onclick = async () => { try { $('#entryPassword').value = (await send({ type: 'generatePassword', length: 20 })).password; } catch (error) { message(error.message); } };
$('#searchPasswords').oninput = renderBook;
$('#fillFirst').onclick = () => { const entry = bookEntries.find(item => item.origin === new URL(activeTab.url).origin); if (entry) fillEntry(entry.id); };
$('#entryForm').onsubmit = async event => { event.preventDefault(); try { await send({ type: 'saveEntries', entry: { name: $('#entryName').value, origin: $('#entryUrl').value, username: $('#entryUsername').value, password: $('#entryPassword').value } }); event.target.reset(); $('#entryUrl').value = new URL(activeTab.url).origin; $('#entryForm').hidden = true; message('Login saved.'); await loadBook(); } catch (error) { message(error.message); } };
(async () => { try { await currentTab(); await loadBooks(); } catch (error) { message(error.message); } })();
