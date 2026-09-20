# Release validation — 2026-09-18

## Verified behavior

- Python server suite: 7 tests passing. Real HTTP requests and temporary files cover explicit grants, unauthorized path/write rejection, Host/Origin checks, static asset restrictions, extension validation, disk-save roundtrips, and externally changed file conflicts.
- Chromium suite: 9 tests passing. Covers offline rendering, HTML sanitization, table/heading rendering, immediate note switching, browser persistence, draft recovery, file import, HTML export, search, formatting, layouts, theme persistence, mobile sizing, backup/restore, native-save races, rich clipboard payloads, storage failure handling, and print/PDF generation.
- Actual macOS Apple Event: opened a disposable Markdown file with the compiled `AetherMark.app`. The app launched Chrome, loaded that file, and an edit through the visible editor autosaved to the same physical file. Disk contents were independently read back.
- The macOS bundle passes `codesign --verify --deep --strict`; its Info.plist passes `plutil -lint`.
- Desktop (1440 × 1000) and mobile (390 × 844) screenshots were visually inspected. Mobile sidebar positioning and rich-copy accessibility in Read view were corrected.
- JavaScript syntax check passes. npm install reports zero dependency vulnerabilities at build time.

## Review coverage

Three read-only simplification lenses returned reuse, quality, and efficiency findings. Applied: clearer save-status branching, race-free temporary-file cleanup, and a single atomic backup-restore write. Kept synchronous browser draft persistence deliberately to avoid a note-switch/close data-loss window. Deferred broader performance restructuring; this release targets individual documents up to 8 MB, not large vaults. The efficiency worker returned its findings before reporting a usage-limit error; its final completion receipt was unavailable.

Code review: skipped (ce-code-review unavailable) — the dedicated review stopped at scope resolution because this initial, uncommitted repository has no resolvable Git base. A manual source scan and the independent simplification findings supplemented the automated and live-browser checks; no completed dedicated code-review receipt is claimed.

The manual scan covered file capabilities, CSRF/Origin/Host restrictions, sanitized render/export paths, storage failure handling, save snapshots, external conflicts, launcher port contention, Python/app portability, and repository secret/path exposure. No credentials, browser notes, runtime tokens, or test documents are included in the repository.

## Limits of verification

Native browser file-picker handles are simulated in the automated race test; the real disk integration is exercised through Finder. Clipboard HTML/plain payloads are verified, but pasting into every version of Google Docs, Sheets, or Word is not. Headless Chromium print CSS and generated PDF bytes are verified; no OS printer workflow is claimed. Safari and Firefox have not been separately tested. The app is ad-hoc signed and not notarized.

## Local operation

Use the save badge as the healthy signal: browser notes say “Saved in browser,” saved disk files say “Saved to disk,” and newer edits remain drafts. If a save fails or the file changes externally, export the current Markdown and reopen the original to compare. Back up Local Notes before clearing browser data or changing the app's server address. Runtime logs live in the per-user temporary `aethermark-*` directory and omit document contents and tokens.
