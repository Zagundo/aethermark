/* AetherMark — local documents, browser drafts, and a sanitized reading view. */
const $ = id => document.getElementById(id);
const editor = $('editor');
const preview = $('preview');
const MAX_BYTES = 8 * 1024 * 1024;
const WELCOME = `# A little space to think.

Welcome to **ÆtherMark**. A quiet place to read, write, and keep your Markdown close.

## Make yourself at home

Open a Markdown file, drop one into the sidebar, or create a local note with **+**. Switch between **Edit**, **Split**, and **Read** whenever you need a different perspective.

- **Local notes** save in this browser as you type.
- **Open** connects a disk file in supported browsers. Use **Save** or **⌘S** to write changes.
- Files opened with the macOS launcher autosave to disk.
- Unsaved file edits get a recovery copy in Local Notes.

## Words with a little structure

> Clarity begins with a little room to think.

Use *emphasis*, **strong ideas**, and \`small pieces of code\`.

| When you want to… | Try… |
| :--- | :--- |
| Focus on your words | Edit view |
| See the finished page | Read view |
| Share polished text | Copy rich text |
| Keep a portable copy | Export → HTML or Markdown |

### A small checklist

- [x] Find a comfortable writing space
- [ ] Write something worth keeping
- [ ] Back up your local notes

### A snippet

\`\`\`javascript
const idea = 'Start with one good sentence.';
console.log(idea);
\`\`\`

---

Everything the app needs is bundled locally. Remote images are blocked to keep your reading private. Browser notes belong to this browser and address; use **Back up notes** to keep a portable copy.
`;

const state = { notes: [], doc: null, layout: 'split', timer: null, token: null, storageOK: true };
let toastTimer;
function notify(message, error = false) {
  $('notification').textContent = message;
  $('notification').className = 'notification' + (error ? ' error' : '');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $('notification').classList.add('hidden'), error ? 12000 : 4500);
}
function errorMessage(error) { notify(error.message || String(error), true); }
function validNotes(value) {
  return Array.isArray(value) && value.every(n => n && typeof n.id === 'string' && typeof n.title === 'string' && typeof n.content === 'string');
}
function readNotes() {
  const raw = localStorage.getItem('ae_notes');
  const notes = raw ? JSON.parse(raw) : [];
  if (!validNotes(notes)) throw new Error('Stored notes could not be read. Existing storage has been left intact.');
  return notes;
}
function persistNote(note, remove = false) {
  try {
    const notes = readNotes().filter(n => n.id !== note.id);
    if (!remove) notes.push(note);
    localStorage.setItem('ae_notes', JSON.stringify(notes));
    state.notes = notes;
    state.storageOK = true;
    renderNotes();
    return true;
  } catch (error) {
    state.storageOK = false;
    notify('Browser storage is unavailable or full. Export your work before leaving. ' + error.message, true);
    return false;
  }
}
function remember(key, value) {
  try { localStorage.setItem(key, value); } catch { /* Optional preference, never document content. */ }
}
function preference(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function dirty(doc = state.doc) { return doc && doc.content !== doc.savedContent; }
function savedStatus(doc, unsaved) {
  if (doc.saving) return 'Saving…';
  if (doc.error) return 'Save failed · draft kept';
  if (unsaved) return state.storageOK ? 'Draft kept · save to disk' : 'Unsaved · export now';
  if (doc.kind === 'vault') return 'Saved in browser';
  if (doc.kind === 'draft') return 'New document';
  return 'Saved to disk';
}
function refreshStatus() {
  const doc = state.doc;
  if (!doc) return;
  const unsaved = dirty(doc);
  $('current-filename').textContent = doc.name;
  $('save-status-dot').className = 'status-dot ' + (unsaved ? 'dirty' : 'clean');
  $('save-status-dot').title = unsaved ? 'Changes have not been saved to the original file' : 'Saved';
  $('saved-badge').textContent = savedStatus(doc, unsaved);
  $('saved-badge').className = 'footer-badge' + (!unsaved && !doc.error ? ' success' : '');
  document.title = `${unsaved ? '• ' : ''}${doc.name} — AetherMark`;
}
function keepDraft(doc) {
  const note = { id: doc.kind === 'vault' ? doc.id : doc.recoveryId, title: doc.kind === 'vault' ? doc.name : `Recovered — ${doc.name}`, content: doc.content, updated: Date.now() };
  const saved = persistNote(note);
  if (saved) {
    remember('ae_last_active_note', note.id);
    if (doc.kind === 'vault') doc.savedContent = doc.content;
  }
  return saved;
}
function maySwitch() {
  if (!state.doc || !dirty()) return true;
  if (!keepDraft(state.doc)) return false;
  return state.doc.kind === 'vault' || confirm('Your edits are kept in Local Notes as a recovery copy. Switch documents without waiting for a disk save?');
}
function activate(doc) {
  clearTimeout(state.timer);
  state.doc = { recoveryId: 'recovery_' + crypto.randomUUID(), ...doc };
  editor.value = doc.content;
  editor.scrollTop = 0;
  refreshStatus();
  renderPreview();
  renderNotes();
}
function openNote(id) {
  const note = state.notes.find(n => n.id === id);
  if (!note || !maySwitch()) return;
  activate({ kind: 'vault', id, name: note.title, content: note.content, savedContent: note.content });
  remember('ae_last_active_note', id);
}
function createNote(title, content = '') {
  const name = /\.md$/i.test(title) ? title : title + '.md';
  const note = { id: crypto.randomUUID(), title: name, content, updated: Date.now() };
  if (persistNote(note)) openNote(note.id);
}
function renderNotes() {
  const query = $('note-search').value.toLowerCase();
  const list = $('vault-list');
  list.replaceChildren();
  const notes = state.notes.filter(n => `${n.title}\n${n.content}`.toLowerCase().includes(query)).sort((a, b) => (b.updated || 0) - (a.updated || 0));
  for (const note of notes) {
    const row = document.createElement('div');
    row.className = 'note-item' + (state.doc?.id === note.id ? ' active' : '');
    const open = document.createElement('button');
    open.className = 'note-open';
    open.textContent = note.title;
    open.title = note.title;
    open.onclick = () => openNote(note.id);
    const rename = document.createElement('button');
    rename.className = 'note-action';
    rename.textContent = '✎';
    rename.title = 'Rename ' + note.title;
    rename.setAttribute('aria-label', rename.title);
    rename.onclick = () => {
      const title = prompt('Note name', note.title)?.trim();
      if (!title) return;
      const renamed = { ...note, title: /\.md$/i.test(title) ? title : title + '.md' };
      if (persistNote(renamed) && state.doc?.id === note.id) { state.doc.name = renamed.title; refreshStatus(); }
    };
    const remove = document.createElement('button');
    remove.className = 'delete-note-btn';
    remove.textContent = '×';
    remove.title = 'Delete ' + note.title;
    remove.setAttribute('aria-label', remove.title);
    remove.onclick = () => {
      if (!confirm(`Delete “${note.title}” from browser notes? This cannot be undone.`)) return;
      if (persistNote(note, true) && state.doc?.id === note.id) {
        state.doc = null;
        if (state.notes.length) openNote(state.notes[0].id); else newDocument();
      }
    };
    row.append(open, rename, remove);
    list.append(row);
  }
  if (!notes.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-notes';
    empty.textContent = query ? 'No matching notes.' : 'Your next idea starts with +';
    list.append(empty);
  }
}
function sanitizedMarkdown(content) {
  if (!window.marked || !window.DOMPurify) throw new Error('Bundled Markdown libraries are missing. Restore the vendor folder.');
  return DOMPurify.sanitize(marked.parse(content, { gfm: true, breaks: true }), {
    USE_PROFILES: { html: true }, FORBID_TAGS: ['style', 'form', 'button', 'textarea', 'select'], FORBID_ATTR: ['style', 'name', 'id']
  });
}
function renderPreview() {
  try {
    preview.innerHTML = sanitizedMarkdown(editor.value);
    preview.querySelectorAll('a').forEach(a => { a.target = '_blank'; a.rel = 'noopener noreferrer'; });
    // Do not load tracking pixels or remote images from documents.
    preview.querySelectorAll('img').forEach(img => {
      if (!img.getAttribute('src')?.startsWith('data:image/')) {
        const placeholder = document.createElement('span');
        placeholder.className = 'image-placeholder';
        placeholder.textContent = `[Image: ${img.alt || 'external image'} — remote loading disabled]`;
        img.replaceWith(placeholder);
      }
    });
    const outline = $('document-outline');
    outline.replaceChildren();
    preview.querySelectorAll('h1,h2,h3').forEach((heading, index) => {
      heading.id = 'heading-' + index;
      const button = document.createElement('button');
      button.textContent = heading.textContent;
      button.className = 'outline-link level-' + heading.tagName.slice(1);
      button.onclick = () => { if (state.layout === 'edit') setLayout('preview'); heading.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
      outline.append(button);
    });
    if (!outline.children.length) outline.textContent = 'Add a heading to find your way.';
  } catch (error) { preview.textContent = editor.value; errorMessage(error); }
  const words = editor.value.trim().split(/\s+/).filter(Boolean).length;
  $('stat-words').textContent = words.toLocaleString();
  $('stat-chars').textContent = editor.value.length.toLocaleString();
  $('stat-time').textContent = Math.ceil(words / 200) + ' min';
}
function onEdit() {
  const doc = state.doc;
  if (!doc) return;
  doc.content = editor.value;
  doc.error = null;
  keepDraft(doc);  // Synchronous browser backup: switching cannot strand a debounce.
  renderPreview();
  refreshStatus();
  clearTimeout(state.timer);
  if (doc.kind === 'file') state.timer = setTimeout(() => saveDocument(doc).catch(errorMessage), 800);
}
function newDocument() {
  if (!maySwitch()) return;
  activate({ kind: 'draft', name: 'untitled.md', content: '', savedContent: '' });
  editor.focus();
}
async function api(path, options = {}) {
  const response = await fetch(path, options);
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'Local file request failed.');
  return result;
}
async function openGrantedFile(id) {
  const data = await api('/api/get-file?id=' + encodeURIComponent(id));
  activate({ kind: 'file', fileId: id, revision: data.revision, name: data.filename, content: data.content, savedContent: data.content });
}
function checkFile(file) {
  if (!/\.(md|markdown|txt)$/i.test(file.name)) throw new Error('Choose a .md, .markdown, or .txt file.');
  if (file.size > MAX_BYTES) throw new Error('Choose a file smaller than 8 MB.');
}
async function importFile(file, handle = null) {
  checkFile(file);
  const content = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
  if (!maySwitch()) return;
  activate({ kind: handle ? 'native' : 'draft', handle, name: file.name, content, savedContent: content });
  if (!handle) notify('File opened as a copy. Save downloads or lets you choose a destination.');
}
async function openFile() {
  if (!window.showOpenFilePicker) { $('file-input-fallback').click(); return; }
  try {
    const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Markdown and text', accept: { 'text/markdown': ['.md', '.markdown', '.txt'] } }] });
    await importFile(await handle.getFile(), handle);
  } catch (error) { if (error.name !== 'AbortError') errorMessage(error); }
}
async function saveDocument(doc = state.doc) {
  if (!doc) return;
  if (doc.saving) { await doc.saving; if (dirty(doc)) return saveDocument(doc); return; }
  const content = doc.content;
  const run = async () => {
    if (doc.kind === 'vault') { if (!keepDraft(doc)) throw new Error('Could not save the browser note. Export it now.'); return; }
    if (doc.kind === 'file') {
      state.token ||= (await api('/api/session')).token;
      const result = await api('/api/save-file', {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-AetherMark-Token': state.token },
        body: JSON.stringify({ id: doc.fileId, content, revision: doc.revision })
      });
      doc.revision = result.revision;
    } else {
      let handle = doc.handle;
      if (!handle && window.showSaveFilePicker) {
        handle = await window.showSaveFilePicker({ suggestedName: doc.name, types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }] });
      }
      if (handle) {
        if (doc.handle && await (await handle.getFile()).text() !== doc.savedContent) throw new Error('File changed on disk. Export your draft, then reopen to compare changes.');
        const writable = await handle.createWritable();
        try { await writable.write(content); await writable.close(); } catch (error) { await writable.abort().catch(() => {}); throw error; }
        doc.handle = handle;
        doc.kind = 'native';
        doc.name = handle.name;
      } else {
        download(content, doc.name, 'text/markdown');
        notify('Download started. Your recovery draft stays in Local Notes.');
        return; // A download cannot confirm disk persistence.
      }
    }
    doc.savedContent = content;
    doc.error = null;
    if (!dirty(doc)) persistNote({ id: doc.recoveryId }, true);
  };
  doc.saving = run();
  refreshStatus();
  try { await doc.saving; }
  catch (error) { if (error.name !== 'AbortError') { doc.error = error.message; throw error; } }
  finally { doc.saving = null; if (state.doc === doc) refreshStatus(); }
}
function download(content, filename, type) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function setLayout(mode) {
  state.layout = mode;
  $('app-workspace').className = 'workspace ' + ({ edit: 'edit-only', split: 'split-mode', preview: 'preview-only' }[mode]);
  for (const key of ['edit', 'split', 'preview']) {
    $('layout-' + key).classList.toggle('active', key === mode);
    $('layout-' + key).setAttribute('aria-pressed', String(key === mode));
  }
  $('reading-mode-badge').textContent = { edit: 'Edit View', split: 'Split View', preview: 'Reading View' }[mode];
  remember('ae_layout', mode);
}
function toggleSidebar() {
  const collapsed = $('app-sidebar').classList.toggle('collapsed');
  $('sidebar-toggle').setAttribute('aria-expanded', String(!collapsed));
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  $('theme-icon-sun').classList.toggle('hidden', theme !== 'dark');
  $('theme-icon-moon').classList.toggle('hidden', theme === 'dark');
  remember('ae_theme', theme);
}
function format(kind) {
  const start = editor.selectionStart, end = editor.selectionEnd;
  const selection = editor.value.slice(start, end);
  const text = selection || 'text';
  const formats = { bold: `**${text}**`, italic: `*${text}*`, strike: `~~${text}~~`, h1: `\n# ${selection || 'Heading'}\n`, h2: `\n## ${selection || 'Heading'}\n`, h3: `\n### ${selection || 'Heading'}\n`, ul: `\n- ${text}\n`, ol: `\n1. ${text}\n`, task: `\n- [ ] ${text}\n`, quote: `\n> ${text}\n`, code: `\n\`\`\`\n${text}\n\`\`\`\n`, link: `[${text}](https://example.com)`, table: '\n| Heading | Heading |\n| --- | --- |\n| Cell | Cell |\n' };
  editor.focus();
  // insertText participates in the browser's native textarea undo history.
  if (!document.execCommand('insertText', false, formats[kind])) editor.setRangeText(formats[kind], start, end, 'select');
  onEdit();
}
function richHTML() {
  const container = document.createElement('div');
  container.innerHTML = sanitizedMarkdown(editor.value);
  const styles = { h1: 'font-size:28px;font-weight:bold;margin:24px 0 12px', h2: 'font-size:22px;font-weight:bold;margin:20px 0 10px', h3: 'font-size:18px;font-weight:bold', p: 'margin:0 0 14px;line-height:1.6', table: 'border-collapse:collapse;width:100%;margin:16px 0', th: 'border:1px solid #ccc;padding:8px;background:#f1f5f9;text-align:left', td: 'border:1px solid #ccc;padding:8px', blockquote: 'border-left:3px solid #6366f1;padding-left:14px;color:#475569', code: 'font-family:monospace;background:#f1f5f9', pre: 'padding:16px;background:#f1f5f9;white-space:pre-wrap' };
  for (const [tag, style] of Object.entries(styles)) container.querySelectorAll(tag).forEach(el => el.setAttribute('style', style));
  container.querySelectorAll('img').forEach(img => { if (!img.src.startsWith('data:image/')) img.remove(); });
  container.style.cssText = 'font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#172033';
  return container.outerHTML;
}
async function copyRich() {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([richHTML()], { type: 'text/html' }), 'text/plain': new Blob([preview.innerText], { type: 'text/plain' }) })]);
    notify('Rich text copied. Paste into your document.');
  } catch { notify('Clipboard access was unavailable. Export HTML or allow clipboard access in your browser.', true); }
}
function exportHTML() {
  const title = state.doc.name.replace(/\.(md|markdown|txt)$/i, '');
  const safeTitle = document.createElement('span'); safeTitle.textContent = title;
  download(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${safeTitle.innerHTML}</title><style>body{max-width:820px;margin:48px auto;padding:0 24px}img{max-width:100%}pre{overflow-wrap:anywhere}a{color:#4f46e5}@media print{body{margin:0}}</style>${richHTML()}</html>`, title + '.html', 'text/html');
}
function bindEvents() {
  editor.addEventListener('input', onEdit);
  $('note-search').oninput = renderNotes;
  $('sidebar-toggle').onclick = toggleSidebar;
  for (const mode of ['edit', 'split', 'preview']) $('layout-' + mode).onclick = () => setLayout(mode);
  $('theme-toggle').onclick = () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark');
  document.querySelectorAll('[data-format]').forEach(button => { button.onmousedown = e => e.preventDefault(); button.onclick = () => format(button.dataset.format); });
  $('file-new').onclick = newDocument;
  $('file-open').onclick = openFile;
  $('file-save').onclick = () => saveDocument().catch(errorMessage);
  $('file-input-fallback').onchange = async e => { try { if (e.target.files[0]) await importFile(e.target.files[0]); } catch (error) { errorMessage(error); } finally { e.target.value = ''; } };
  $('sidebar-add-note').onclick = () => { $('vault-note-name').value = ''; $('save-vault-dialog').showModal(); $('vault-note-name').focus(); };
  $('dialog-cancel').onclick = () => $('save-vault-dialog').close();
  $('save-vault-form').onsubmit = e => { e.preventDefault(); const title = $('vault-note-name').value.trim(); if (title) { createNote(title, '# ' + title + '\n\n'); $('save-vault-dialog').close(); } };
  $('copy-formatted').onclick = copyRich;
  $('copy-plain').onclick = async () => { try { await navigator.clipboard.writeText(editor.value); notify('Markdown copied.'); } catch (error) { errorMessage(error); } };
  $('export-trigger').onclick = e => { e.stopPropagation(); $('export-menu').classList.toggle('hidden'); };
  document.addEventListener('click', () => $('export-menu').classList.add('hidden'));
  $('export-md').onclick = () => download(editor.value, state.doc.name, 'text/markdown');
  $('export-html').onclick = exportHTML;
  $('export-pdf').onclick = () => window.print();
  $('backup-notes').onclick = () => { try { download(JSON.stringify({ app: 'AetherMark', version: 1, notes: readNotes() }, null, 2), 'aethermark-notes.json', 'application/json'); } catch (error) { errorMessage(error); } };
  $('restore-notes').onclick = () => $('backup-input').click();
  $('backup-input').onchange = async e => {
    try {
      const file = e.target.files[0]; if (!file) return;
      if (file.size > MAX_BYTES) throw new Error('Backup exceeds 8 MB.');
      const data = JSON.parse(await file.text());
      if (data.app !== 'AetherMark' || data.version !== 1 || !validNotes(data.notes)) throw new Error('This is not a valid AetherMark backup.');
      const notes = [...readNotes(), ...data.notes.map(note => ({ ...note, id: crypto.randomUUID() }))];
      localStorage.setItem('ae_notes', JSON.stringify(notes));
      state.notes = notes;
      renderNotes();
      notify(`Restored ${data.notes.length} notes as new copies.`);
    } catch (error) { errorMessage(error); } finally { e.target.value = ''; }
  };
  window.addEventListener('dragover', e => e.preventDefault());
  window.addEventListener('drop', async e => {
    e.preventDefault(); $('sidebar-dropzone').classList.remove('dragover');
    try { if (e.dataTransfer.files[0]) await importFile(e.dataTransfer.files[0]); } catch (error) { errorMessage(error); }
  });
  $('sidebar-dropzone').ondragover = () => $('sidebar-dropzone').classList.add('dragover');
  $('sidebar-dropzone').ondragleave = () => $('sidebar-dropzone').classList.remove('dragover');
  let syncing = false;
  const scroller = document.querySelector('.preview-scroll-container');
  for (const [from, to] of [[editor, scroller], [scroller, editor]]) from.addEventListener('scroll', () => {
    if (syncing || state.layout !== 'split') return;
    const range = from.scrollHeight - from.clientHeight;
    if (range <= 0) return;
    syncing = true;
    to.scrollTop = from.scrollTop / range * (to.scrollHeight - to.clientHeight);
    requestAnimationFrame(() => { syncing = false; });
  });
  window.addEventListener('keydown', e => {
    if (e.key === 'Escape') $('export-menu').classList.add('hidden');
    if (!(e.metaKey || e.ctrlKey)) return;
    const key = e.key.toLowerCase();
    if (key === 's') { e.preventDefault(); saveDocument().catch(errorMessage); }
    if (key === 'o') { e.preventDefault(); openFile(); }
    if (key === '\\') { e.preventDefault(); toggleSidebar(); }
    if (document.activeElement === editor && ['b', 'i'].includes(key)) { e.preventDefault(); format(key === 'b' ? 'bold' : 'italic'); }
  });
  window.addEventListener('beforeunload', e => { if (dirty() || state.doc?.saving) { e.preventDefault(); e.returnValue = ''; } });
  window.addEventListener('storage', e => {
    if (e.key !== 'ae_notes') return;
    try {
      state.notes = readNotes(); renderNotes();
      if (state.doc?.kind === 'vault') {
        const note = state.notes.find(n => n.id === state.doc.id);
        if (note && !dirty()) { state.doc.content = state.doc.savedContent = note.content; state.doc.name = note.title; editor.value = note.content; renderPreview(); refreshStatus(); }
      }
    } catch (error) { errorMessage(error); }
  });
  document.querySelectorAll('button[title]').forEach(button => { if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', button.title); });
}
async function init() {
  bindEvents();
  applyTheme(preference('ae_theme') || 'dark');
  setLayout(innerWidth < 800 ? 'edit' : ['edit', 'split', 'preview'].includes(preference('ae_layout')) ? preference('ae_layout') : 'split');
  if (innerWidth < 800) toggleSidebar();
  try { state.notes = readNotes(); } catch (error) { state.storageOK = false; errorMessage(error); }
  const fileId = new URLSearchParams(location.search).get('file');
  if (fileId) {
    try { await openGrantedFile(fileId); return; } catch (error) { errorMessage(error); }
  }
  const lastId = preference('ae_last_active_note');
  if (state.notes.length) openNote(state.notes.some(n => n.id === lastId) ? lastId : state.notes[0].id);
  else if (state.storageOK) createNote('Welcome', WELCOME);
  if (!state.doc) activate({ kind: 'draft', name: 'Welcome.md', content: WELCOME, savedContent: WELCOME });
}
init().catch(errorMessage);
