# OpenClaw RPC Methods

## Agents

### `agents.list`
Returns configured agents.

**Params:** none
**Response:** `{ agents: AgentEntry[] }`

### `agents.create`
Creates a new agent.

**Params:**
- `workspace` (string, **required**) — filesystem path for agent's working directory
- `name` (string) — agent display name

**Response:** Created agent entry.

### `agents.update`
Modifies agent config.

### `agents.delete`
Removes an agent.

### `agent.identity.get`
Gets agent identity info.

### `agents.files.list` / `agents.files.get` / `agents.files.set`
Manage workspace files.

## Sessions

### `sessions.list`
Returns all active sessions.

**Params:** none
**Response:** `{ sessions: Session[] }`

### `sessions.create`
Creates a new session for an agent.

**Params:**
- `agentId` (string) — references a configured agent
- `model` (string, optional) — model override

### `sessions.get`
Gets session details.

### `sessions.patch`
Updates session properties.

### `sessions.send`
Sends a message/command to a session.

**Params:**
- `sessionKey` (string) — session identifier
- `command` (string) — command to send

### `sessions.steer`
Interrupts and redirects a session.

### `sessions.abort`
Aborts current session activity.

### `sessions.reset`
Resets session state.

### `sessions.delete`
Deletes/stops a session.

**Params:**
- `sessionKey` (string) — session to delete

### `sessions.compact`
Compacts session history.

### `sessions.subscribe` / `sessions.unsubscribe`
Subscribe to session events.

### `sessions.messages.subscribe` / `sessions.messages.unsubscribe`
Subscribe to session message stream.

### `sessions.preview`
Preview session state.

### `sessions.usage` / `sessions.usage.timeseries` / `sessions.usage.logs`
Get session usage metrics.

## Chat

### `chat.send`
Sends a user message to an agent session.

**Params:**
- `sessionKey` (string) — session to message
- `message` (string) — user message content
- `idempotencyKey` (string) — dedup key

## Tasks

### `tasks.create`
Creates a new task.

**Params:**
- `title` (string)
- `assigneeId` (string, optional)

### `tasks.update`
Updates task status/assignee.

**Params:**
- `taskId` (string)
- `updates` (object) — fields to update

## System

### `tick`
Keepalive. Sent periodically.

**Params:** none

## Device

### `device.token.rotate`
Rotates device token.

### `device.token.revoke`
Revokes device token.

## Tools

### `tools.catalog`
Lists available tools.

### `tools.effective`
Lists effective tools for current context.

## Other

### `skills.status` / `skills.bins`
Skill management.

### `doctor.memory.status`
Memory diagnostics.
