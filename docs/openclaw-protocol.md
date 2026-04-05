# OpenClaw Gateway Protocol

## Overview

OpenClaw Hub connects to an OpenClaw Gateway server via WebSocket. The protocol uses a request/response + event streaming model over JSON frames.

## Frame Types

All communication uses JSON frames with a `type` field:

### Request Frame (Client -> Gateway)
```json
{ "type": "req", "id": "unique-id", "method": "agents.list", "params": {} }
```

### Response Frame (Gateway -> Client)
```json
{ "type": "res", "id": "unique-id", "ok": true, "payload": { ... } }
```

### Event Frame (Gateway -> Client)
```json
{ "type": "event", "event": "chat", "payload": { ... }, "seq": 1 }
```

## Connection Handshake

1. Client opens WebSocket to gateway URL (e.g. `ws://localhost:18789`)
2. Gateway sends `connect.challenge` event with a nonce
3. Client responds with `connect` RPC:
   ```json
   {
     "type": "req",
     "id": "...",
     "method": "connect",
     "params": {
       "minProtocol": 3,
       "maxProtocol": 3,
       "client": {
         "id": "openclaw-control-ui",
         "version": "0.1.0",
         "platform": "web",
         "mode": "ui"
       },
       "role": "operator",
       "scopes": ["operator.read", "operator.write", "operator.admin"],
       "auth": { "token": "<OPENCLAW_GATEWAY_TOKEN>" },
       "device": {
         "id": "<stable fingerprint from keypair>",
         "publicKey": "<base64 public key>",
         "signature": "<base64 signed challenge>",
         "signedAt": "<ISO timestamp>",
         "nonce": "<echoed nonce from connect.challenge>"
       },
       "caps": [],
       "commands": [],
       "permissions": {},
       "locale": "en-US",
       "userAgent": "openclaw-control-ui/0.1.0"
     }
   }
   ```
4. Gateway responds with `hello-ok` payload:
   - `policy.tickIntervalMs` — keepalive interval (default ~15s)
   - `auth.deviceToken` — optional token for session persistence

## Device Identity

The `device` block is **required** for Control UI connections. It uses the WebCrypto API to generate a keypair and sign the server's challenge nonce.

**Requirements:**
- WebCrypto API (available only in secure contexts: HTTPS or `http://localhost`)
- A stable keypair stored in IndexedDB or localStorage
- The nonce from the `connect.challenge` event must be echoed back

**Workarounds for non-HTTPS:**
- Access via `http://localhost` (secure context)
- SSH tunnel: `ssh -N -L 18789:127.0.0.1:18789 user@server`
- Set `gateway.controlUi.dangerouslyDisableDeviceAuth: true` in `openclaw.json`
- Use an HTTPS reverse proxy (Caddy, Nginx, Traefik)

## Keepalive

After handshake, client sends periodic `tick` requests at the interval specified by `policy.tickIntervalMs`:

```json
{ "type": "req", "id": "...", "method": "tick", "params": {} }
```

If the connection drops, the client auto-reconnects with exponential backoff (max 30s).

## Authentication

- Token-based auth via `OPENCLAW_GATEWAY_TOKEN` environment variable
- Token is sent during the handshake `connect` request in `auth.token`
- Device token (from `hello-ok`) is stored in `localStorage` as `openclaw-device-token`

## Implementation

See `packages/core/src/ws-client.ts` — the `WsClient` class.
