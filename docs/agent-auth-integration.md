# Agent Authentication & SDK Integration

Research notes for integrating Claude Code and OpenAI Codex authentication into Studio.

## Claude Code

### Authentication Methods (precedence order)

1. **Cloud providers** — `CLAUDE_CODE_USE_BEDROCK=1`, `CLAUDE_CODE_USE_VERTEX=1`, or `CLAUDE_CODE_USE_FOUNDRY=1` + provider credentials
2. **`ANTHROPIC_AUTH_TOKEN`** — Bearer token, used for LLM gateway/proxy routing
3. **`ANTHROPIC_API_KEY`** — Direct API key from [Console](https://platform.claude.com), sent as `X-Api-Key` header
4. **`apiKeyHelper`** — Custom shell script that returns an API key (supports rotation, vault-backed secrets). Refresh every 5min or on 401. Configure `CLAUDE_CODE_API_KEY_HELPER_TTL_MS` for custom interval
5. **`CLAUDE_CODE_OAUTH_TOKEN`** — Long-lived (1 year) OAuth token generated via `claude setup-token`. For CI/scripts where browser login is unavailable
6. **Subscription OAuth** (`/login`) — Browser-based OAuth for Pro/Max/Team/Enterprise users

### Credential Storage

- **macOS**: encrypted macOS Keychain
- **Linux/Windows**: `~/.claude/.credentials.json` (mode `0600` on Linux), or `$CLAUDE_CONFIG_DIR`

### Claude Agent SDK

- **TypeScript**: `npm install @anthropic-ai/claude-agent-sdk`
- **Python**: `pip install claude-agent-sdk`
- **Server-side only** (Node.js / Python) — does NOT run in browser
- Auth: `ANTHROPIC_API_KEY` env var (API key billing)
- Also supports Bedrock, Vertex, Azure via env vars

```typescript
import { query } from "@anthropic-ai/claude-agent-sdk";

for await (const message of query({
  prompt: "Find and fix the bug in auth.py",
  options: { allowedTools: ["Read", "Edit", "Bash"] }
})) {
  console.log(message);
}
```

Key features:
- Built-in tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, Monitor
- Sessions: capture `session_id` from init message, resume with `{ resume: sessionId }`
- Subagents: spawn focused subtasks via Agent tool
- MCP: connect external tools (Playwright, databases, etc.)
- Hooks: PreToolUse, PostToolUse, Stop, SessionStart, SessionEnd
- Permissions: allowedTools whitelist, permissionMode ("acceptEdits" etc.)

### Restrictions

> "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK."

- Subscription OAuth tokens (`sk-ant-oat01-*`) are **rejected** by the Anthropic Messages API
- As of April 2026, subscription quota access for third-party tools was cut off
- Only API key billing is available for programmatic/third-party use

### References

- [Authentication docs](https://code.claude.com/docs/en/authentication)
- [Agent SDK overview](https://code.claude.com/docs/en/agent-sdk/overview)
- [Agent SDK TypeScript reference](https://code.claude.com/docs/en/agent-sdk/typescript)
- [OAuth API issue #37205](https://github.com/anthropics/claude-code/issues/37205)

---

## OpenAI Codex

### Authentication Methods

1. **ChatGPT Sign-In** — Opens browser for OAuth flow, returns access token to CLI. Auto-refreshes during active sessions. Works with Plus/Pro/Business/Edu/Enterprise plans
2. **API Key** — From [OpenAI dashboard](https://platform.openai.com/api-keys). Standard API rate billing. Recommended for CI/CD
3. **Device Code Auth** (beta) — For headless environments, sign in via separate device code URL

### Credential Storage

Configurable via `cli_auth_credentials_store`:
- `file` — `~/.codex/auth.json` under `CODEX_HOME`
- `keyring` — OS credential store (macOS Keychain, Windows Credential Manager, etc.)
- `auto` — OS store if available, fallback to `auth.json`

> **Security**: auth.json contains access tokens. Never commit, share, or expose it.

### Codex SDK

- **TypeScript**: `npm install @openai/codex-sdk`
- **Server-side only** (Node.js 18+) — does NOT run in browser
- Inherits auth from Codex CLI configuration

```typescript
import { Codex } from "@openai/codex-sdk";

const codex = new Codex();
const thread = codex.startThread();
const result = await thread.run("Your prompt here");
// Continue on same thread:
const result2 = await thread.run("Follow up question");
```

Key features:
- Thread management with persistent session IDs
- Multi-turn conversations
- Resume past threads by ID

### Codex Cloud (Web)

- Delegates tasks to cloud environments
- GitHub integration (connect repos, create PRs, tag @codex on issues)
- Beta API: `openai.beta.codex.cloud.create()` with `task_prompt`, `environment`, `repository_context`, `webhook`
- Code review: `POST /v1/codex/reviews` (beta)

### References

- [Codex authentication](https://developers.openai.com/codex/auth)
- [Codex CLI reference](https://developers.openai.com/codex/cli/reference)
- [Codex SDK](https://developers.openai.com/codex/sdk)
- [Codex Cloud](https://developers.openai.com/codex/cloud)

---

## Integration Plan for Studio

### Architecture

Both SDKs are server-side only. Studio needs Next.js API routes as proxies:

```
Browser (Studio UI)
  → POST /api/agent/claude  { prompt, sessionId, apiKey }
  → Server: Claude Agent SDK → stream SSE response back

Browser (Studio UI)
  → POST /api/agent/codex   { prompt, threadId, apiKey }
  → Server: Codex SDK → stream SSE response back
```

### Authentication Flow

1. **API Keys** (primary) — User enters keys in Studio Settings page. Stored encrypted in localStorage or server-side. Passed to SDK via env vars or options.

2. **Codex ChatGPT OAuth** (possible) — Codex supports browser OAuth that returns a token. Studio could implement "Login with ChatGPT" button that initiates this flow and captures the token.

3. **Claude OAuth** — **NOT allowed** for third-party apps. Only API keys.

### What Works

| Method | Claude | Codex |
|--------|--------|-------|
| API key from user | Yes (ANTHROPIC_API_KEY) | Yes (OpenAI API key) |
| Browser OAuth login | No (forbidden for 3rd party) | Yes (ChatGPT sign-in) |
| Cloud provider auth | Yes (Bedrock/Vertex/Azure) | No |
| Subscription billing | No (API only for 3rd party) | Yes (via ChatGPT OAuth) |

### Implementation Steps

1. Create `/api/agent/claude/route.ts` — accepts prompt + API key, uses Claude Agent SDK, streams response via SSE
2. Create `/api/agent/codex/route.ts` — accepts prompt + API key or token, uses Codex SDK, streams response
3. Update Settings UI — add API key inputs for both providers (already partially done)
4. (Optional) Implement Codex ChatGPT OAuth flow — redirect to ChatGPT login, capture token on callback
5. Wire up chat to use these routes when provider is selected instead of/alongside OpenClaw gateway
