const fs = require('node:fs');
fs.mkdirSync('vendor', { recursive: true });
for (const [source, target] of [
  ['marked/lib/marked.umd.js', 'marked.umd.js'],
  ['marked/LICENSE', 'marked.LICENSE'],
  ['dompurify/dist/purify.min.js', 'purify.min.js'],
  ['dompurify/LICENSE', 'DOMPurify.LICENSE']
]) fs.copyFileSync(`node_modules/${source}`, `vendor/${target}`);
