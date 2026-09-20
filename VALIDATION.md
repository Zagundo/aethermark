# Release validation

Last verified: 2026-09-18

## Automated checks

- **Server:** 7 tests covering explicit file grants, unauthorized read/write
  rejection, Host and Origin checks, the static asset allowlist, file-type
  validation, atomic saves, and external-change conflicts.
- **Browser:** 9 Chromium tests covering offline rendering, sanitization,
  Markdown features, note persistence, recovery drafts, imports, exports,
  search, formatting, responsive layouts, themes, backup and restore, save
  races, rich clipboard output, storage failures, and print/PDF output.
- **Continuous integration:** the same server and browser suites run on every
  push and pull request through GitHub Actions.

## Manual checks

- A compiled `AetherMark.app` was opened through a real macOS Finder Apple
  Event. An edit in the browser autosaved to the selected physical file and was
  read back from disk.
- The app bundle passed `codesign --verify --deep --strict`, and its
  `Info.plist` passed `plutil -lint`.
- Desktop at 1440 × 1000 and mobile at 390 × 844 were visually inspected.
- The tracked repository and complete Git history were scanned for credentials,
  private filesystem paths, browser notes, runtime tokens, and test documents.

## Known limits

- Browser file-picker handles are simulated in automated tests; real disk
  integration is exercised through Finder.
- Clipboard HTML and plain-text payloads are verified, but every destination
  application and version is not tested.
- Headless Chromium print CSS and generated PDF bytes are verified; the macOS
  printer dialog is not automated.
- Safari and Firefox are not separately tested.
- The macOS app is ad-hoc signed and is not notarized.

## Operational signals

- Healthy browser notes show **Saved in browser**.
- Healthy disk files show **Saved to disk**.
- A failed or conflicting save keeps a recovery draft. Export the current
  Markdown and reopen the original file to compare changes.
- Back up Local Notes before clearing browser data or changing the app's server
  address.
- Runtime logs live in the per-user temporary `aethermark-*` directory and omit
  document contents and tokens.
