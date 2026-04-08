# Studio v0.2 — Architecture Plan

## Problem

Studio v0.1 has views that work in isolation. There's no unified entity system, no cross-referencing between entities, no package system for extensibility, and the distinction between human/agent workflows is unclear.

## Vision

Studio is a **workspace** where humans and AI agents collaborate. The core manages **entities** and their relationships. Views are **packages** that render and interact with entities. Everything is filterable, linkable, and extensible.

---

## 1. Entity System (Core)

### 1.1 Core Entities

| Entity | Description | Storage |
|---|---|---|
| **Agent** | AI agent config (from OpenClaw) | Gateway RPC |
| **Session** | A conversation thread (1 or many agents + human) | Gateway + localStorage |
| **Task** | Work item (human or agent) | `media/tasks/` JSON |
| **Media** | Files: markdown, images, docs | `media/` filesystem |
| **Project** | Groups entities together | `media/projects/` JSON |
| **InternalDoc** | System prompts, configs (read-only) | Generated from code |

### 1.2 Entity Relationships

```
Project ──┬── has many Sessions
          ├── has many Tasks  
          ├── has many Media files
          └── has many Agents (assigned)

Session ──┬── belongs to Project (optional)
          ├── has many Agents (participants)
          ├── has many Messages
          └── has many Attachments (Media, Tasks)

Task ────┬── belongs to Project (optional)
         ├── assigned to Agent (optional)
         ├── created by Agent or Human
         └── has many Attachments (Media)

Agent ───┬── belongs to Projects (many-to-many)
         ├── has many Sessions
         └── has many Tasks (assigned)
```

### 1.3 Entity Registry (Core)

```typescript
// packages/core/src/entity-registry.ts

interface EntityDefinition {
  id: string              // "agent", "session", "task", "media", "project"
  label: string           // "Agent", "Session", etc.
  labelPlural: string     // "Agents", "Sessions", etc.
  icon: string            // lucide icon name
  filterableBy: string[]  // ["project", "agent"] — which entities can filter this
  fields: FieldDefinition[]
}

interface FieldDefinition {
  key: string
  label: string
  type: "string" | "number" | "date" | "enum" | "relation"
  relation?: string       // entity ID for relation fields
  enumValues?: string[]
}

// Registry
const entityRegistry = new Map<string, EntityDefinition>()

function registerEntity(def: EntityDefinition): void
function getEntity(id: string): EntityDefinition | undefined
function listEntities(): EntityDefinition[]
```

This allows packages to register new entity types without modifying core.

---

## 2. Package System

### 2.1 Package Structure

```
packages/
  core/           — entity registry, gateway, stores, types
  views/
    agents/       — Agent Manager view (package)
    sessions/     — Sessions/Chat view (package)  
    kanban/       — Agent Kanban (agent tasks)
    tasks/        — Human Tasks view
    media/        — Media browser
    todo/         — removed, merged into tasks
    code-editor/  — View code editor
```

### 2.2 Package Manifest

Each view package has a manifest:

```typescript
// src/views/sessions/manifest.ts
export const manifest = {
  id: "sessions",
  title: "Sessions",
  icon: "message-square",
  version: "0.1.0",
  entities: ["session"],        // entities this view manages
  filters: ["agent", "project"], // filter bar entities
  actions: [                     // actions this view exposes
    { id: "new-session", label: "New Session", icon: "plus" },
  ],
}
```

### 2.3 Package API

Each package exports:
- `manifest` — metadata
- `default` — React component (the view)
- `registerEntities()` — optional, registers custom entities
- `getActions()` — optional, actions for command palette

### 2.4 Future: Package Update System

```
/api/packages              — list installed packages
/api/packages/install      — install from URL/registry
/api/packages/update       — update a package
/api/packages/check        — check for updates
```

For v0.2, packages are local directories. Remote install comes later.

---

## 3. View Redesign

### 3.1 Universal View Layout

Every view follows this structure:

```
┌─────────────────────────────────────────────────┐
│ [View Header]                              [⚙]  │
│ Title              [Filter: Agent ▼] [Project ▼] │
├─────────────────────────────────────────────────┤
│                                                  │
│  [View Content — specific to each view]          │
│                                                  │
└─────────────────────────────────────────────────┘
```

- **⚙ Cog menu**: Clone view, Edit code (if custom), View settings
- **Filter bar**: Filters by related entities (agents, projects)
- **Content**: View-specific

### 3.2 Cog Dropdown (All Views)

```
⚙ ──┬── Clone as editable copy
    ├── Edit code (custom views only)
    ├── View settings
    └── Close view
```

### 3.3 Sessions View (replaces Chats)

**Left sidebar:**
- Session list (each session = a conversation thread)
- "New Session" button → dialog to name + select agents
- Filters: by agent, by project
- Each session shows: name, participating agents, last message preview, date

**Main area:**
- Message thread (like current chat)
- Multi-agent: messages tagged with which agent responded
- Attachment bar: drag media, link tasks, link entities
- Input: select which agent to message (if multiple in session)

**Session model:**
```typescript
interface Session {
  id: string
  name: string
  agents: string[]          // agent IDs
  projectId?: string
  messages: Message[]
  attachments: Attachment[]
  createdAt: number
  updatedAt: number
}

interface Attachment {
  type: "media" | "task" | "entity"
  entityType: string
  entityId: string
  path?: string             // for media
}
```

### 3.4 Tasks View (Human Tasks)

For the human. Shows tasks created by human or assigned to human.

- Columns: Backlog, In Progress, Review, Done
- Each task: title, description, assigned agent, project, attachments
- Filters: by project, by agent
- Agents can add tasks here via `task.create` tool with `owner: "human"`

### 3.5 Kanban View (Agent Work)

For agents. Shows what agents are working on.

- Columns: Queue, Working, Waiting for Review, Complete
- Each card: task description, agent, session link, tokens used
- Filters: by agent, by project
- Auto-populated from agent activity (session events)

**Key distinction:**
- Tasks view = human's todo list ("what I need to do")
- Kanban view = agent dashboard ("what agents are doing")
- Both reference the same Task entity but filter by `owner` field

### 3.6 Media View

- Add filters: by agent (who created), by project
- Internal docs section: shows system prompts, agent configs (read-only)
- Internal docs generated from:
  - `MEDIA_TOOLS_PROMPT` constant
  - Agent system prompts
  - View manifests

### 3.7 Agent Manager

- Cog dropdown for each agent (not just detail panel)
- Quick actions: open session, assign to project, view tasks

---

## 4. Filter System (Core)

### 4.1 Universal Filter Component

```typescript
// src/components/entity-filter.tsx

interface EntityFilterProps {
  entityType: string        // "agent", "project"
  value: string | null      // selected entity ID
  onChange: (id: string | null) => void
}

function EntityFilter({ entityType, value, onChange }: EntityFilterProps)
```

Renders a dropdown populated from the entity registry. Used by all views.

### 4.2 Filter State

Filters are stored per-tab in `tabState`:

```typescript
// Tab state includes filters
{
  filters: {
    agent: "main",
    project: "proj-1"
  }
}
```

Views read filters from tab state and apply them to their data.

---

## 5. Internal Docs

### 5.1 What's Included

| Document | Source | Description |
|---|---|---|
| Media Tools Prompt | `MEDIA_TOOLS_PROMPT` constant | What agents know about tools |
| Agent Configs | `agents.list` response | Raw agent configurations |
| View Manifests | View packages | What views are installed |
| System Architecture | This file | How the system works |

### 5.2 Implementation

```
media/
  _internal/          — auto-generated, read-only in UI
    agent-prompts.md
    agent-configs.md
    view-manifests.md
    architecture.md
```

Generated on connect/startup. Media view shows them with a "System" badge and read-only flag.

---

## 6. Implementation Order

### Phase 1: Core Foundation (do first)
1. **Entity registry** — `packages/core/src/entity-registry.ts`
2. **Universal filter component** — `src/components/entity-filter.tsx`
3. **Cog dropdown component** — `src/components/view-cog-menu.tsx`
4. **Project entity** — CRUD via media API, project store
5. **Update view headers** — add cog + filters to all views

**Test:** Each view shows cog menu. Filter dropdowns appear. Projects can be created.

### Phase 2: Sessions (replaces Chats)
6. **Session entity** — create/list/delete sessions
7. **Multi-agent sessions** — select agents for session
8. **Session view** — replace chats with sessions view
9. **Attachments** — attach media/tasks to messages
10. **Message routing** — send to specific agent in multi-agent session

**Test:** Create session with 2 agents. Send message to specific agent. Attach a media file. Filter sessions by agent.

### Phase 3: Task Separation
11. **Task entity upgrade** — add `owner` field (human/agent), `projectId`
12. **Human Tasks view** — filtered to human tasks
13. **Agent Kanban** — filtered to agent tasks, auto-populated from events
14. **Agent proactive kanban** — agents use `task.create` with proper owner/project

**Test:** Create human task. Agent creates agent task. Both show in correct view. Filter by project works.

### Phase 4: Media & Internal Docs
15. **Media filters** — by agent, by project
16. **Internal docs generation** — auto-generate on connect
17. **Internal docs in media** — show with "System" badge, read-only

**Test:** Internal docs appear in media/_internal/. Media filters work. Files show which agent created them.

### Phase 5: Package System
18. **Package manifest format** — define spec
19. **Package loader** — scan src/views/ for manifests
20. **Package registry API** — `/api/packages`
21. **View picker from manifests** — use manifests for view picker

**Test:** Move a view to package format. View still loads. Manifest info shows in view picker.

### Phase 6: Design Polish
22. **Update studio.pen** — add cog, filters, session view design
23. **Align UI to design** — polish all views
24. **Responsive** — handle smaller screens

---

## 7. File Structure (Target)

```
packages/
  core/
    src/
      entity-registry.ts    — NEW: entity definitions
      types.ts               — updated with new entity types  
      gateway-store.ts       — updated
      session-store.ts       — NEW: session management
      project-store.ts       — NEW: project management
      ...

src/
  components/
    entity-filter.tsx        — NEW: universal filter dropdown
    view-cog-menu.tsx        — NEW: cog dropdown for all views
    view-header.tsx          — NEW: universal view header with cog + filters
    markdown-renderer.tsx    — existing
    ...
  
  views/
    agents/                  — renamed from agent-manager
      index.tsx
      manifest.ts            — NEW
    sessions/                — NEW (replaces chats)
      index.tsx
      manifest.ts
    kanban/                  — agent work board
      index.tsx  
      manifest.ts
    tasks/                   — human tasks (replaces todo)
      index.tsx
      manifest.ts
    media/
      index.tsx
      manifest.ts
    code-editor/
      index.tsx
    ...
```

---

## 8. Testing Checklist

### After Phase 1:
- [ ] Cog dropdown appears on all views
- [ ] Clone works from cog menu
- [ ] Edit code works from cog menu (custom views)
- [ ] Project can be created via API
- [ ] Filter dropdowns appear but may not filter yet
- [ ] Entity registry has: agent, session, task, media, project

### After Phase 2:
- [ ] "New Session" creates a named session with selected agents
- [ ] Session list shows in sidebar
- [ ] Messages route to correct agent in multi-agent session
- [ ] Media can be attached to a message
- [ ] Task can be linked in a message
- [ ] Filter sessions by agent works
- [ ] Filter sessions by project works

### After Phase 3:
- [ ] Human task created → appears in Tasks view only
- [ ] Agent task created → appears in Kanban only
- [ ] Both appear if "All" filter selected
- [ ] Filter by project works in both views
- [ ] Agent proactively creates tasks in correct kanban

### After Phase 4:
- [ ] `media/_internal/` contains generated docs
- [ ] Internal docs show "System" badge in media view
- [ ] Internal docs are read-only
- [ ] Media filter by agent shows files by creator
- [ ] Media filter by project works

### After Phase 5:
- [ ] At least one view has manifest.ts
- [ ] View loads from manifest
- [ ] View picker reads manifest metadata
- [ ] `/api/packages` lists installed packages

---

## 9. AMS (Agent Management System) Vision

### Core Concept
Studio is an AMS — Agent Management System. Community-driven, extensible with custom apps.

### Naming Conventions
- Sessions → **Chats** (more intuitive)
- Kanban → **Tasks Kanban** (agent tasks board)
- Views → **Apps**

### Agent Management
- Manage agent skills, tools, credentials
- Create/modify agents through chat with another agent
- Future agent types: image generation, video generation, designer, QA, voice

### Integrations (Demo Apps)
- Telegram bots
- Supabase
- Deployments (GitHub Pages, GoDaddy, Vercel)

### UI Features
- Renamable apps
- Chat sidebar: custom prompt (configure agent communication), attachments from media, connected apps
- Split view: when agent creates/modifies content in another app/media, show "Open in new tab" / "Open in split view" buttons

---

## 10. Design Decisions

### Why not a database?
Files + localStorage is enough for v0.2. The gateway handles agent/session state. We store human state (tasks, projects, media) as files. This keeps it simple, portable, and git-friendly.

### Why packages as directories?
Like WordPress plugins — each view is a self-contained directory. It can be copied, shared, or updated independently. The manifest declares what it needs. Core doesn't need to know about specific views.

### Why separate Tasks and Kanban?
Mental model: "Tasks" = my todo list (human perspective). "Kanban" = what's happening (agent perspective). Same underlying entity, different filters and UI. Keeps the cognitive load low.

### Why Sessions instead of Chats?
"Chat" implies 1:1. "Session" implies a workspace where things happen — multiple agents, attachments, tools. Sessions are the central collaboration unit.
