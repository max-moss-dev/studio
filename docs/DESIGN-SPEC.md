# Studio v0.2 — Design Specification

This document describes every screen/app that needs to be designed in `design/studio.pen`. Use Pencil MCP tools to build them.

---

## Global Components (shared across all screens)

### Header Bar (44px height, #1e2127)
- **Left:** Logo icon (28x28, #3e4451 rounded, layers icon) + "Studio" text (15px Geist 600, #abb2bf)
- **Center:** Tab bar — each tab has icon (13px) + title (12px Inter 500) + close X. Active tab: bg #282c34, text #d7dae0. Inactive: text #5c6370. Plus (+) button at end for new tab
- **Right:** Connection status badge (green dot + "Connected" or red "Disconnected"), logout icon

### App Header (below tab bar, inside each app)
- **Left:** App title (16px Geist 600, #d7dae0)
- **Center:** Filter pills — [Agent ▾] [Project ▾] dropdowns (11px, rounded-full, #2c313a bg, #5c6370 text, border #3e4451)
- **Right:** Cog icon (⚙) button + app-specific action buttons (e.g. "+ New Chat")

### Cog Dropdown (200px wide, when ⚙ clicked)
- bg #2c313a, border #3e4451, cornerRadius 8, shadow
- Items (each 32px height, padding 8 12):
  - "Clone as copy" — copy icon, #abb2bf
  - "Edit Code" — code icon, #abb2bf (only for custom apps)
  - "App Settings" — settings icon, #abb2bf
  - Separator line (#3e4451)
  - "Close App" — x icon, #e06c75

### Footer Bar (28px, #1e2127)
- **Left:** Connection indicator dot + URL (10px mono, #5c6370) + separator + latency
- **Right:** "Studio v0.1.0" (10px, #5c6370)

---

## Screen 1: Agents App

**Frame:** 1440x900, "Agents"

### Layout: Sidebar (320px) + Detail Panel (fill)

### Sidebar
- **Header area:**
  - Title "Agents" (16px Geist 600, #d7dae0)
  - "+ Add Agent" button (right-aligned, small, primary blue)
- **Search:** Input (36px height, #2c313a, border #3e4451, search icon + placeholder "Search agents...")
- **Filter pills row:** All | Online | Busy | Offline | Error — rounded pills, active has bg #3e4451
- **Agent list:** Scrollable, gap 2px, padding 8px
  - Each agent card: padding 10 12, cornerRadius 8, selected: bg #2c313a
    - Avatar: 36x36 circle, role-colored (orchestrator=#61afef, coder=#98c379, reviewer=#c678dd, researcher=#e5c07b, custom=#5c6370), white lucide icon inside (crown/code/eye/search/terminal)
    - Info column: Name (13px Inter 500, #d7dae0) + status dot (8px circle, right-aligned) on first row. Second row: "role · model" (11px, #5c6370)

### Detail Panel (right side, fill remaining, padding 32 40)
- **Header:** Large avatar (56x56) + Name (22px Geist 600) + role badge (#2c313a pill, role-colored text) + status badge (dot + text)
- **Actions row:** "Chat" button (message-square icon), "Restart" button (rotate-ccw icon), "Delete" button (trash, red, disabled for "main")
- **Stats grid (2 columns):**
  - Output Tokens: value (18px semibold)
  - Input Tokens: value
  - Model: text
  - Status: badge
  - Uptime: text
- **Config section:** Label "Config" + JSON code block (#2c313a, mono font, scrollable max-h 160)

### Empty state (no agent selected):
- Center text: "Select an agent to view details" (#5c6370)

---

## Screen 2: Chats App (formerly "Sessions")

**Frame:** 1440x900, "Chats"

### Layout: Sidebar (300px) + Chat Area (fill)

### App Header
- Filters: [Agent ▾] [Project ▾]
- Actions: "+ New Chat" button (primary)

### Sidebar (300px, border-right #3e4451)
- **Chat list:** Each item:
  - Chat name (13px Inter 500, #d7dae0)
  - Agent avatars: up to 3 overlapping small circles (20px), colored by role
  - Last message preview (11px, #5c6370, truncated 1 line)
  - Time (11px, #5c6370, right-aligned)
  - Selected: bg #2c313a, cornerRadius 8

### Chat Area (right panel)
- **Chat header bar:**
  - Agent avatar (32px) + name + role·model subtitle
  - Right side: "Config" button (opens agent in Agents app) + cog icon
- **Right sidebar panel (collapsible, 260px):**
  - **Custom Prompt** section: textarea for system prompt customization
  - **Attachments** section: list of attached media files, "+ Add" button
  - **Connected Apps** section: list of linked apps/views, "+ Connect" button
- **Messages area:** Scrollable, max-w 640 centered
  - User messages: right-aligned, primary blue bg, white text, 14px
  - Agent messages: left-aligned, #2c313a bg, markdown rendered, agent avatar + name label
  - Tool results: collapsible card with wrench icon, "Open file" link for media tools
  - Multi-agent: each agent message shows small colored avatar + agent name above bubble
- **Input bar (bottom, border-top):**
  - Paperclip button (attach media/entity)
  - Agent selector dropdown (if multi-agent chat): small avatar + name
  - Text input (full width)
  - Send button (arrow-up icon, primary blue)

### New Chat Dialog (modal, 480px wide)
- Title: "New Chat"
- Fields:
  - Name: text input
  - Agents: multi-select list with checkboxes, each agent shows avatar + name + role
  - Project: dropdown (optional)
- Buttons: Cancel, Create

---

## Screen 3: Tasks Kanban (Agent Work)

**Frame:** 1440x900, "Tasks Kanban"

### App Header
- Filters: [Agent ▾] [Project ▾]
- Title: "Tasks Kanban" subtitle: "What agents are working on"

### Kanban Board (horizontal scroll)
- **Columns:** Queue | Working | Review | Done
- Each column: header (14px semibold, #d7dae0) + count badge + scrollable cards
- **Task card:** (cornerRadius 8, bg #2c313a, border #3e4451, padding 12)
  - Title (13px medium, #d7dae0)
  - Agent avatar (20px) + agent name (11px, #5c6370)
  - Token usage (11px mono, #5c6370)
  - Project tag (if assigned, small colored pill)
  - Chat link icon (opens related chat)
- **Drag-and-drop** between columns

---

## Screen 4: App Store (New Tab)

**Frame:** 1440x900, "App Store"

### Layout: centered content, max-width 860, vertical stack

---

### Section 1: Pinned Apps (top)
- Label: "Pinned" (12px Geist 600, #5c6370, uppercase tracking)
- **Horizontal row** of app icon tiles, gap 12, scrollable if overflow
- Each tile (72x72 total, cornerRadius 12, bg #2c313a, hover: border #61afef):
  - Icon circle (36x36, colored bg, white icon inside, cornerRadius 8)
  - App name below icon (10px Inter 500, #abb2bf, centered, 1 line truncated)
- Pin/unpin via right-click context menu or drag from main grid
- Default pinned: Agents, Chats, Tasks Kanban, Media, Projects

---

### Section 2: Search Bar
- Centered, 600px max-width
- Large input (44px height, #2c313a, border #3e4451, cornerRadius 10)
- Left: search icon (14px, #5c6370)
- Placeholder: "Search apps…" (#5c6370)
- Live-filters the active tab content below

---

### Section 3: Tabbed App Grid (Core · Demo · Categories)

**Tab bar** — left-aligned, below search, gap 0, border-bottom #3e4451:
- Tabs: **Core** | **Demo** | **Categories**
- Active tab: text #d7dae0, border-bottom 2px #61afef, bg transparent
- Inactive tab: text #5c6370
- Each tab 80px wide, 36px height, 13px Inter 500

#### Core tab (default active)
- Description row: "Essential apps for your workspace" (12px, #5c6370) — shown below tab bar
- **Grid: 2 columns**, gap 12
- App card (cornerRadius 12, bg #2c313a, padding 16, hover: border #61afef):
  - Icon circle (40x40, colored bg, white icon)
  - Title (14px semibold, #d7dae0)
  - Description (12px, #5c6370, 2 lines max)

**Core apps:**
| App | Icon | Color | Description |
|---|---|---|---|
| Agents | users | #61afef | Manage AI agents, skills, and configs |
| Chats | message-square | #98c379 | Multi-agent conversations |
| Tasks Kanban | kanban | #e5c07b | Agent work dashboard |
| Media | file-text | #c678dd | Knowledge base & files |
| Projects | folder | #61afef | Organize work into projects |

#### Demo tab
- Description row: "Showcase apps & starting points" (12px, #5c6370)
- **Grid: 3 columns**, gap 12
- Same card style, muted icon colors (#3e4451 bg circles)

**Demo apps:**
| App | Icon | Description |
|---|---|---|
| Office | building-2 | 3D agent visualization |
| Human Tasks | check-circle | Personal task management |
| Calendar | calendar | Schedule & events |
| Skills | zap | Agent skill browser |
| Cron Jobs | clock | Scheduled automations |
| Credentials | shield | Secure credential vault |
| Design | palette | Visual design workspace |
| Telegram | send | Telegram bot integration |
| Deployments | rocket | Deploy to GitHub Pages, Vercel |

#### Categories tab
- Description row: "Browse by category" (12px, #5c6370)
- **Grid: 3 columns**, gap 12
- Category cards (cornerRadius 12, bg #2c313a, padding 16, hover: border #61afef):
  - Category icon (28x28, colored)
  - Category name (13px semibold, #d7dae0)
  - App count badge (10px, #5c6370)

**Categories:**
| Category | Icon | Color |
|---|---|---|
| Productivity | check-square | #98c379 |
| Communication | message-circle | #61afef |
| Automation | cpu | #e5c07b |
| Security | shield | #e06c75 |
| Design | palette | #c678dd |
| Data | database | #61afef |

---

### Section 4: Create New (bottom)
- Centered, margin-top 24
- "**+ Create New App**" button (primary, 44px height, 200px wide, bg #61afef, text white, cornerRadius 8, plus icon left)
- Subtext below: "Build a custom app or clone an existing one" (11px, #5c6370, centered)

---

## Screen 5: Media App

**Frame:** 1440x900, "Media"

### Layout: File Browser Sidebar (320px) + Preview Panel (fill)

### App Header
- Filters: [Agent ▾] [Project ▾]
- Shows which agent created the file / which project it belongs to

### File Browser Sidebar
- **Toolbar:** Back arrow (if in subfolder) + current path + refresh
- **Actions:** File | Folder | Upload buttons (small, outlined)
- **File tree:** 
  - Folders: folder icon (#e5c07b), name, chevron
  - Markdown files: file-text icon (#61afef), name, size
  - Images: image icon (#c678dd), name, size
  - Delete button on hover (trash, red)
- **Internal docs section** (at bottom, separated):
  - Label "System" badge (#3e4451 pill)
  - Files: agent-prompts.md, agent-configs.md, etc.
  - Lock icon — read-only

### Preview Panel
- **Header:** filename + date + Edit/Save buttons
- **Markdown preview:** rendered markdown with:
  - Interactive checkboxes (- [ ] / - [x])
  - Styled tables, code blocks, blockquotes
  - Headings hierarchy
  - Links (blue, underlined)
- **Image preview:** centered, max-fit
- **Edit mode:** plain textarea with monospace font

---

## Screen 6: Projects App

**Frame:** 1440x900, "Projects"

### Layout: Sidebar (300px) + Detail Panel (fill)

### Sidebar
- "+ New Project" button
- Project list:
  - Color dot (12px, user-chosen color) + name (14px medium, #d7dae0)
  - Stats: "3 agents · 5 chats · 12 tasks" (11px, #5c6370)
  - Selected: bg #2c313a

### Detail Panel (padding 32 40)
- **Header:** Color dot (16px) + Project name (22px Geist 600) + edit icon
- **Stats row:** Agent count | Chat count | Task count | Media count — each in a small card
- **Sections (vertical, gap 24):**
  - **Agents:** List of assigned agents with avatars, "+" button to assign more
  - **Recent Chats:** Latest 5 chats with preview, "View all" link
  - **Tasks:** Task list with status colors (queue=#5c6370, working=#e5c07b, review=#61afef, done=#98c379)
  - **Media:** File list with icons, "View all" link

---

## Screen 7: Human Tasks App

**Frame:** 1440x900, "Human Tasks"

### App Header
- Filters: [Agent ▾] [Project ▾]
- "+ Add Task" button

### Layout: Task list (full width, max-w 800 centered)
- **Filter tabs:** All | Active | Done + category filters (general, bug, feature, research, urgent, idea — colored dots)
- **Add task input:** text field + category dropdown + Add button
- **Task list:** Each task:
  - Circle checkbox (unchecked: #5c6370, checked: #98c379 with checkmark)
  - Task text (14px, #d7dae0, strikethrough when done)
  - Category tag (colored pill, 10px)
  - Agent badge (if created by agent: bot icon + name, #61afef)
  - Project tag (if assigned)
  - Date (10px, #5c6370)
  - Delete on hover (trash icon, red)
- **"Clear done"** link at top-right when done tasks exist

---

## Screen 8: Chat Sidebar Detail

**Frame:** 1440x900, "Chat with Sidebar"

Same as Screen 2 but with the right sidebar **open**, showing:
- **Custom Prompt** panel: textarea (200px height, #2c313a, mono font)
  - Label: "System prompt override"
  - Help text: "Customize how the agent behaves in this chat"
- **Attachments** panel:
  - List of attached files from media (icon + name + size)
  - "+ Attach file" button
  - Drag zone outline
- **Connected Apps** panel:
  - List of linked apps with icons
  - "+ Connect app" button
- **Split View buttons** on messages: when agent creates/edits content elsewhere, show:
  - "Open in new tab" button
  - "Open in split view" button

---

## Screen 9: New Chat Dialog

**Frame:** 480x500, floating dialog (show on top of Chat screen)

- **Title:** "New Chat" (18px Geist 600)
- **Chat name:** Text input, placeholder "e.g. Feature Research"
- **Select Agents:** Scrollable list with checkboxes
  - Each: avatar (24px) + name (13px) + role badge + model (11px, #5c6370)
  - Selected: checkmark, highlighted bg
- **Project:** Dropdown, "None" default, list of projects with color dots
- **Buttons:** Cancel (ghost) + Create (primary blue)

---

## Screen 10: Cog Dropdown Detail

**Frame:** 1440x900, "Cog Dropdown Example"

Show any app (e.g. Media) with the cog dropdown open:
- App header with title + filters + cog icon (highlighted)
- Dropdown below cog (200px wide, #2c313a, border #3e4451, cornerRadius 8, shadow):
  - Copy icon + "Clone as copy" (#abb2bf)
  - Code icon + "Edit Code" (#abb2bf) — only if custom
  - Settings icon + "App Settings" (#abb2bf)
  - Separator (#3e4451, 1px)
  - X icon + "Close App" (#e06c75)

---

## Design Tokens Reference

| Token | Hex | Usage |
|---|---|---|
| bg | #282c34 | Main background |
| header-bg | #1e2127 | Header, footer |
| surface | #2c313a | Cards, inputs, dropdowns |
| border | #3e4451 | Borders, separators |
| tab-border | #2e3239 | Tab dividers |
| text-primary | #d7dae0 | Headings, names |
| text-secondary | #abb2bf | Body text, labels |
| text-muted | #5c6370 | Descriptions, hints |
| online/green | #98c379 | Online, done, success |
| blue | #61afef | Primary, orchestrator, links |
| purple | #c678dd | Reviewer, images |
| yellow | #e5c07b | Busy, researcher, folders |
| red | #e06c75 | Error, delete, destructive |
| orange | #d19a66 | Warning |

### Typography
- **Headings:** Geist, semibold (600)
- **Body:** Inter, normal/medium (400/500)
- **Mono:** monospace (code, stats)
- **Sizes:** 22px page title, 16px section title, 14px body, 13px list items, 12px secondary, 11px tertiary, 10px footer

### Icon Library
- Lucide React icons throughout
- Size: 13-14px in UI, 18px in avatars, 28px in detail avatars

### Spacing
- Views: padding 32 40 for detail panels
- Cards: padding 10-16, cornerRadius 8-12
- Gaps: 2-4px tight, 8-12px normal, 16-24px sections
