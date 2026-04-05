# OpenClaw Gateway Events

Events are pushed from the Gateway to clients via WebSocket event frames.

## Chat Events

### `chat`
Primary event for agent messages. Supports streaming.

**Payload:**
```json
{
  "runId": "message-id",
  "sessionKey": "agent-session-key",
  "state": "delta" | "final" | "error" | "aborted",
  "message": {
    "content": [
      { "type": "text", "text": "Agent response..." }
    ]
  }
}
```

- `state: "delta"` — streaming update (cumulative text)
- `state: "final"` — message complete
- `state: "error"` — error occurred
- `state: "aborted"` — message was cancelled

### Legacy Events (backward-compatible)
- `message.received` / `chat.message` — complete message received
- `message.chunk` / `chat.chunk` — streaming chunk

## Session Events

### `session.created`
New session started.

**Payload:** Session object with sessionKey, agent config, status.

### `session.updated`
Session state changed (e.g. agent started working).

**Payload:** Updated session object.

### `session.deleted` / `session.closed`
Session ended.

**Payload:** `{ sessionKey: "..." }`

## Presence Events

### `system-presence` / `presence`
Agent online/offline status updates.

**Payload:** Map of session keys to presence state.

## Task Events

### `task.created`
New task added.

**Payload:** Task object.

### `task.updated`
Task status/assignee changed.

**Payload:** Updated task object.

## Agent Events

### `agent.status_changed`
Agent status transition.

**Payload:** `{ agentId, status, ... }`

### `exec.approval.requested`
Agent is requesting approval to execute an action.

**Payload:** Approval request details.

## Connection Events

### `connect.challenge`
Sent by gateway immediately after WebSocket opens. Contains nonce for handshake.

### `pong`
Response to client ping.

### `error`
Error notification.

**Payload:** `{ code: "...", message: "..." }`
