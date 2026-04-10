# Studio — Branches & Commits Guide

Ordered from newest (most features) to oldest (base).

## Branches (newest → oldest)

### `claude/tauri-desktop` — Tauri v2 desktop app (latest)
```
442c2bd feat: add Tauri v2 desktop app shell
```
Includes everything from wave6 + full Tauri scaffold with system tray,
native file dialogs, notifications, and tauri-bridge.ts.

### `claude/wave6-landing-page` — All features + landing page
```
facc087 feat: landing page for early access signups
ca1dc65 feat: keyboard shortcuts, error boundary for MVP readiness
7bd67d8 feat: tab drag reorder, middle-click close, close-others
637d22e feat: add multi-provider settings (Claude Code, Codex, OpenClaw)
8b0afd8 style: align UI with design spec (Pencil file)
2a785c3 test: add Vitest setup with 61 tests, cleanup dead code
3532dad feat: replace Sucrase with Sandpack runtime, add view builder pipeline
```

### `claude/wave5-mvp-critical` — All features except landing page
```
ca1dc65 feat: keyboard shortcuts, error boundary for MVP readiness
```

### `claude/wave3-ui-features` — Tabs reorder + all previous
```
7bd67d8 feat: tab drag reorder, middle-click close, close-others
```

### `claude/wave2-multi-provider` — Provider settings + all previous
```
637d22e feat: add multi-provider settings (Claude Code, Codex, OpenClaw)
```

### `claude/wave1-design-polish` — Design fixes + all previous
```
8b0afd8 style: align UI with design spec (Pencil file)
```

### `claude/tests-and-cleanup` — Tests + cleanup + all previous
```
2a785c3 test: add Vitest setup with 61 tests, cleanup dead code
```

### `claude/project-overview-plans-mfBo7` — Sandpack + builder pipeline (base)
```
3532dad feat: replace Sucrase with Sandpack runtime, add view builder pipeline
```

---

## Quick Switch

```bash
# Latest version (everything + Tauri desktop)
git checkout claude/tauri-desktop

# Without Tauri (web only)
git checkout claude/wave6-landing-page

# Without landing page
git checkout claude/wave5-mvp-critical

# Without keyboard shortcuts
git checkout claude/wave3-ui-features

# Without tab reorder
git checkout claude/wave2-multi-provider

# Without multi-provider
git checkout claude/wave1-design-polish

# Without design polish
git checkout claude/tests-and-cleanup

# Just Sandpack + builder pipeline
git checkout claude/project-overview-plans-mfBo7
```

---

## Feature Summary

| Branch | Key Feature |
|--------|------------|
| tauri-desktop | Tauri v2 desktop shell with system tray, native dialogs |
| wave6-landing-page | Landing page at `/landing` for early access signups |
| wave5-mvp-critical | Keyboard shortcuts (Ctrl+T/W/1-9), error boundary |
| wave3-ui-features | Tab drag reorder, middle-click close, closeOthers |
| wave2-multi-provider | Claude Code / Codex / OpenClaw provider selection |
| wave1-design-polish | Agent avatars, message bubbles, kanban polish |
| tests-and-cleanup | Vitest setup (61 tests), dead code cleanup |
| project-overview-plans-mfBo7 | Sandpack runtime, builder pipeline, skill system, sharing, network graph |
