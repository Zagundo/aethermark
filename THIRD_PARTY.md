# Third-party components

Vendored browser dependencies are copied without modification from the exact npm versions in `package-lock.json`:

- [Marked](https://marked.js.org/), 18.0.13 — MIT; license in `vendor/marked.LICENSE`.
- [DOMPurify](https://github.com/cure53/DOMPurify), 3.4.15 — Apache-2.0 or MPL-2.0; license in `vendor/DOMPurify.LICENSE`.

Development-only browser testing uses [Playwright](https://playwright.dev/), 1.63.0, Apache-2.0.

The interface and original feature set were developed from the reference files supplied by Simon Tracey. Their README and Obsidian note described earlier work with Antigravity. This repository contains the revised implementation; it does not assert a new license for the supplied application code.
