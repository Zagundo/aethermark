# Third-party components

Vendored browser dependencies are copied without modification from the exact npm versions in `package-lock.json`:

- [Marked](https://marked.js.org/), 18.0.13 — MIT; license in `vendor/marked.LICENSE`.
- [DOMPurify](https://github.com/cure53/DOMPurify), 3.4.15 — Apache-2.0 or MPL-2.0; license in `vendor/DOMPurify.LICENSE`.

Development-only browser testing uses [Playwright](https://playwright.dev/), 1.63.0, Apache-2.0.

AetherMark's original application code is released under the MIT License in
[`LICENSE`](LICENSE). The third-party components above retain their respective
licenses.
