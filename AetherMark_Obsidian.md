---
name: AetherMark
categories:
  - "[[Apps]]"
type: Local Markdown Editor & Reader
purpose: Read and edit individual Markdown files, keep browser notes, and copy rich text.
macOS: Yes — browser UI with optional Finder app
iOS: No native app
website: http://127.0.0.1:9001
docs: https://github.com/Zagundo/aethermark
status: "[[Active]]"
accountTier: Self-hosted
signIn: No
API_Key: None
aliases:
  - AetherMark
  - ÆtherMark
updated: 2026-09-18
related:
  - "[[Obsidian]]"
  - "[[Markdown]]"
---

# AetherMark

A local Markdown reader and editor for isolated `.md`, `.markdown`, and `.txt` files. Use it for reading without importing into an Obsidian vault, focused writing, and copying formatted text into document tools.

## Launch

Double-click `start_aethermark.command`, or run `python3 launch.py` in the project. Requires Python 3.10+. The optional `AetherMark.app` is built with `python3 scripts/build_macos_app.py` and supports Finder **Open With**.

## Storage

Local Notes save in the current browser and exact server address. Back them up with **Back up notes** before clearing browser data or moving between app copies.

Files opened through the Finder app or `launch.py file.md` autosave to disk. Browser **Open** file handles use explicit **Save**. Dropped files open as copies. Unsaved file edits receive recovery notes; externally changed files are not blindly overwritten.

## Useful features

- Edit, Split, and Read views; light and dark themes.
- Note search, heading outline, rename, backup, and restore.
- Rich text clipboard, Markdown and HTML export, browser Print / PDF.
- Offline bundled dependencies, sanitized Markdown, loopback-only server, explicit file grants.

See the repository README for current behavior and limitations. Standard Markdown is supported; Obsidian plugins, wikilinks, transclusions, and local relative image resolution are not.
