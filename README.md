# ÆtherMark

A local Markdown reader and editor for a little space to think. Open a single file, write a browser note, or read in a distraction-free view. No account, build step, telemetry, or network connection is needed to use it.

## Start on macOS

Requires **Python 3.10+** and a modern browser. Node.js is only needed for development.

Double-click **`start_aethermark.command`**, or run:

```sh
python3 launch.py
```

Open a particular file:

```sh
python3 launch.py "/path/to/My note.md"
```

The launcher reuses this copy's local server, normally at `http://127.0.0.1:9001`. If that port belongs to something else, it selects an available port without stopping any process. Keep using the same launcher and browser: browser notes are scoped to the exact address and port.

For Windows or Linux, run `python3 server.py` (or `py server.py`) and visit `http://127.0.0.1:9001`. The browser editor works there; `launch.py` and the Finder app are macOS/Unix helpers.

## Finder “Open With” app

On macOS:

```sh
python3 scripts/build_macos_app.py
```

This creates `AetherMark.app` in the project directory. Move it somewhere convenient, then use Finder's **Open With → Other… → AetherMark.app** for `.md`, `.markdown`, and `.txt` files. The app contains the server, frontend, and libraries, so it can move independently of the checkout. It still requires Python 3.10+. It is locally ad-hoc signed, not notarized or distributed through the App Store.

The builder will not replace an existing app. Choose a new location with `--output /path/to/AetherMark.app` when rebuilding. A moved or separately packaged copy gets its own server identity and may use another port; export a notes backup before moving between copies.

## Read and write

- **Edit / Split / Read** views, synchronized scrolling, light and dark themes.
- Markdown headings, lists, checklists, blockquotes, tables, code, links, and inline images using data URLs.
- Search local note titles and contents; jump through a document outline; rename or delete notes.
- Formatting toolbar and native editor undo/redo.
- **Copy rich text** puts sanitized HTML with inline styles and readable plain text on the clipboard. Paste support varies by destination; tables are included. **Copy Markdown** copies the source.
- Export Markdown or standalone HTML; **Print / Export PDF** uses the browser print dialog.
- Back up all browser notes to JSON and restore them as new copies, without replacing existing notes.

## Where your writing is saved

| Opened from | Save behavior |
| --- | --- |
| Local Notes sidebar | Saved to this browser's local storage on every edit. |
| Finder app / `launch.py file.md` | Autosaves to the explicitly opened file after a short pause. |
| **Open**, in Chrome or Edge | **Save** / **⌘S** writes to the file selected in the browser. |
| Drag and drop / browsers without file handles | Opens a copy. **Save** offers a destination or downloads the file. |
| **New** | Keeps a recovery draft as you type; **Save** chooses a destination. |

Unsaved disk edits also get a **Recovered — filename** note. A successful disk save removes that recovery copy only when it matches the saved text. If you edit during a save, the newer text remains marked unsaved. A file changed externally is rejected on save, so export your draft and reopen the file to compare. External programs can still write in the tiny interval between the final conflict check and replacement; this is not a distributed lock.

Browser storage can be cleared or exhausted. **Back up notes** regularly. On a storage failure, the editor keeps your text visible and blocks document switching so you can export it. Private browsing is not durable storage.

## Shortcuts

| Shortcut | Action |
| --- | --- |
| ⌘S / Ctrl+S | Save |
| ⌘O / Ctrl+O | Open |
| ⌘B / Ctrl+B | Bold selection |
| ⌘I / Ctrl+I | Italic selection |
| ⌘\\ / Ctrl+\\ | Toggle sidebar |
| ⌘P / Ctrl+P | Print / PDF |
| Escape | Close export menu |

## Privacy and file boundaries

The server listens only on `127.0.0.1`. It checks Host/Origin, serves only the frontend asset allowlist, and requires a session token for writes. Finder files are registered by the launcher with a separate private token; arbitrary URL paths cannot read or write your disk. Saves use a temporary sibling and atomic replacement after checking a content revision.

Markdown is sanitized by DOMPurify. Scripts, embedded frames, and remote images are blocked. Relative disk images and Obsidian-specific plugins, wikilinks, and transclusions are not supported. Clicking an external link opens your browser normally. Files must be UTF-8 and no larger than 8 MB.

There is no cloud sync. This app is intended for a trusted local machine, not hosting on a network or the public internet.

## Development and tests

```sh
npm ci
npm run vendor
npx playwright install chromium
npm run test:server
npm test
```

The shipped `vendor/` contains pinned Marked and DOMPurify browser builds plus their licenses; no npm installation is required by end users. `npm run vendor` refreshes them from the lockfile-installed packages. See [THIRD_PARTY.md](THIRD_PARTY.md).

Tests cover server file grants, conflict detection, atomic file saves, host/origin restrictions, asset exposure, note persistence, immediate switching, recovery, sanitization, exports, clipboard payloads, layout, storage failures, and native-save races. Browser file-picker handles are simulated in automated tests; the Finder path is additionally exercised against a real local file during release verification.

## Repository

[Zagundo/aethermark](https://github.com/Zagundo/aethermark)
