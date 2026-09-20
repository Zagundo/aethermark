const { test, expect } = require('@playwright/test');
const fs = require('node:fs/promises');

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#editor')).toContainText('');
  await expect(page.locator('#current-filename')).toHaveText('Welcome.md');
});

test('renders offline, sanitizes documents, shows outline, and persists immediate edits', async ({ page, context }) => {
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await context.route('**/*', route => new URL(route.request().url()).hostname === '127.0.0.1' ? route.continue() : route.abort());
  await page.reload();
  await page.locator('#editor').fill('# My draft\n\n**Strong** and *gentle*.\n\n| A | B |\n|---|---|\n| One | Two |\n\n<script>window.pwned=1</script><img src=x onerror="window.pwned=1">');
  await expect(page.locator('#preview h1')).toHaveText('My draft');
  await expect(page.locator('#preview strong')).toHaveText('Strong');
  await expect(page.locator('#preview table')).toHaveCount(1);
  await expect(page.locator('#preview script')).toHaveCount(0);
  expect(await page.evaluate(() => window.pwned)).toBeUndefined();
  await expect(page.locator('.outline-link').first()).toHaveText('My draft');
  await page.reload();
  await expect(page.locator('#editor')).toHaveValue(/My draft/);
  expect(errors).toEqual([]);
});

test('switching notes immediately never overwrites either note', async ({ page }) => {
  await page.locator('#editor').fill('# First note is preserved');
  await page.locator('#sidebar-add-note').click();
  await page.locator('#vault-note-name').fill('Second');
  await page.locator('#dialog-confirm').click();
  await page.locator('#editor').fill('# Second note is preserved');
  await page.getByRole('button', { name: 'Welcome.md', exact: true }).click();
  await expect(page.locator('#editor')).toHaveValue('# First note is preserved');
  await page.waitForTimeout(900);
  await page.getByRole('button', { name: 'Second.md', exact: true }).click();
  await expect(page.locator('#editor')).toHaveValue('# Second note is preserved');
  await page.locator('#note-search').fill('First note');
  await expect(page.locator('.note-open')).toHaveCount(1);
  await expect(page.locator('.note-open')).toHaveText('Welcome.md');
});

test('imports files, protects dirty drafts, restores them after reload, and exports HTML', async ({ page }) => {
  await page.locator('#file-input-fallback').setInputFiles({ name: 'example.md', mimeType: 'text/markdown', buffer: Buffer.from('# Imported\n\nHello') });
  await expect(page.locator('#current-filename')).toHaveText('example.md');
  await page.locator('#editor').fill('# Kept recovery\n\n**Important**');
  page.on('dialog', dialog => dialog.accept());
  await page.locator('#file-new').click();
  await page.getByRole('button', { name: 'Recovered — example.md', exact: true }).click();
  await expect(page.locator('#editor')).toHaveValue(/Kept recovery/);
  await page.reload();
  await expect(page.locator('#editor')).toHaveValue(/Kept recovery/);
  const downloaded = page.waitForEvent('download');
  await page.locator('#export-trigger').click();
  await page.locator('#export-html').click();
  const html = await fs.readFile(await (await downloaded).path(), 'utf8');
  expect(html).toContain('<strong>Important</strong>');
  expect(html).toContain('<!doctype html>');
});

test('supports layouts, theme, keyboard formatting, outline navigation, and mobile sizing', async ({ page }) => {
  await page.locator('#editor').fill('hello');
  await page.locator('#editor').selectText();
  await page.keyboard.press('Control+b');
  await expect(page.locator('#editor')).toHaveValue('**hello**');
  await page.locator('#layout-preview').click();
  await expect(page.locator('#pane-editor')).toBeHidden();
  await page.locator('#layout-edit').click();
  await expect(page.locator('#pane-preview')).toBeHidden();
  await page.locator('#theme-toggle').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await expect(page.locator('#file-save')).toBeVisible();
  await page.locator('#layout-preview').click();
  await expect(page.locator('#preview')).toBeVisible();
});

test('backup and restore roundtrip preserves content and malformed backups do not change notes', async ({ page }) => {
  await page.locator('#editor').fill('# Backup me');
  const downloading = page.waitForEvent('download');
  await page.locator('#backup-notes').click();
  const data = await fs.readFile(await (await downloading).path());
  await page.locator('#backup-input').setInputFiles({ name: 'notes.json', mimeType: 'application/json', buffer: data });
  await expect(page.locator('.note-open')).toHaveCount(2);
  await page.locator('#backup-input').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{}') });
  await expect(page.locator('#notification')).toContainText('not a valid');
  await expect(page.locator('.note-open')).toHaveCount(2);
});

test('native save retains dirty state when typing during write and rejects external changes', async ({ page }) => {
  await page.evaluate(() => {
    window.testDisk = '# Original';
    window.showOpenFilePicker = async () => [{ name: 'native.md', getFile: async () => new File([window.testDisk], 'native.md'), createWritable: async () => ({ write: async content => { await new Promise(r => setTimeout(r, 300)); window.testDisk = content; }, close: async () => {}, abort: async () => {} }) }];
  });
  await page.locator('#file-open').click();
  await expect(page.locator('#editor')).toHaveValue('# Original');
  await page.locator('#editor').fill('# First edit');
  await page.locator('#file-save').click();
  await page.locator('#editor').fill('# Second edit');
  await page.waitForTimeout(500);
  await expect(page.locator('#saved-badge')).toContainText('Draft kept');
  expect(await page.evaluate(() => window.testDisk)).toBe('# First edit');
  await page.locator('#file-save').click();
  await expect(page.locator('#saved-badge')).toHaveText('Saved to disk');
  await page.evaluate(() => { window.testDisk = '# Edited externally'; });
  await page.locator('#editor').fill('# Local conflict');
  await page.locator('#file-save').click();
  await expect(page.locator('#notification')).toContainText('changed on disk');
  expect(await page.evaluate(() => window.testDisk)).toBe('# Edited externally');
});

test('rich clipboard contains inline styles and readable plain text', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.locator('#editor').fill('# Heading\n\n**Hello**\n\n| A | B |\n|---|---|\n|1|2|');
  await page.locator('#copy-formatted').click();
  await expect(page.locator('#notification')).toContainText('Rich text copied');
  const clipboard = await page.evaluate(async () => {
    const [item] = await navigator.clipboard.read();
    return { html: await (await item.getType('text/html')).text(), plain: await (await item.getType('text/plain')).text() };
  });
  expect(clipboard.html).toContain('border:1px solid #ccc');
  expect(clipboard.plain).toContain('Hello');
  expect(clipboard.plain).not.toContain('**');
});

test('storage failures keep the edited content and prevent losing it on switch', async ({ page }) => {
  await page.evaluate(() => { Storage.prototype.setItem = function () { throw new DOMException('Quota reached', 'QuotaExceededError'); }; });
  await page.locator('#editor').fill('# Cannot lose this');
  await expect(page.locator('#saved-badge')).toContainText('Unsaved');
  await page.locator('#file-new').click();
  await expect(page.locator('#editor')).toHaveValue('# Cannot lose this');
});


test('print mode exposes the document even from edit-only mode', async ({ page }) => {
  await page.locator('#editor').fill('# Printable document\n\nA paragraph worth keeping.');
  await page.locator('#layout-edit').click();
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('.app-header')).toBeHidden();
  await expect(page.locator('#pane-editor')).toBeHidden();
  await expect(page.locator('#preview h1')).toBeVisible();
  const pdf = await page.pdf({ format: 'A4' });
  expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
  expect(pdf.length).toBeGreaterThan(1000);
});
