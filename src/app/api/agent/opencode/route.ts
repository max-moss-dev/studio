import { NextRequest } from "next/server"

/**
 * POST /api/agent/opencode
 *
 * Proxy to OpenCode server. Supports:
 * - { action: "ping" }                         → check connectivity
 * - { action: "providers" }                     → list configured providers
 * - { action: "sessions" }                      → list sessions
 * - { action: "create", model? }                → create session
 * - { action: "prompt", sessionId, content }    → send message (streaming SSE)
 * - { action: "messages", sessionId }           → get session messages
 * - { action: "abort", sessionId }               → abort session
 * - { action: "agents" }                        → list configured agents
 * - { action: "create-agent", agent }            → create agent via config patch
 * - { action: "models" }                        → list providers & default models
 */

const DEFAULT_URL = "http://localhost:4096"

function getBaseUrl(request: NextRequest): string {
  return request.headers.get("x-opencode-url") || DEFAULT_URL
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const baseUrl = getBaseUrl(request)
  const { action } = body

  try {
    switch (action) {
      case "ping": {
        const res = await fetch(`${baseUrl}/config`, { signal: AbortSignal.timeout(3000) })
        if (!res.ok) throw new Error(`OpenCode responded ${res.status}`)
        const data = await res.json()
        return Response.json({ ok: true, config: data })
      }

      case "providers": {
        const res = await fetch(`${baseUrl}/config/providers`)
        return Response.json(await res.json())
      }

      case "sessions": {
        const res = await fetch(`${baseUrl}/session`)
        return Response.json(await res.json())
      }

      case "create": {
        const res = await fetch(`${baseUrl}/session`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: body.model }),
        })
        return Response.json(await res.json())
      }

      case "messages": {
        const res = await fetch(`${baseUrl}/session/${body.sessionId}/message`)
        return Response.json(await res.json())
      }

      case "abort": {
        const res = await fetch(`${baseUrl}/session/${body.sessionId}/abort`, { method: "POST" })
        return Response.json({ ok: res.ok })
      }

      case "prompt": {
        // OpenCode expects "parts" array, not "content" string
        const res = await fetch(`${baseUrl}/session/${body.sessionId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Accept": "text/event-stream" },
          body: JSON.stringify({ parts: [{ type: "text", text: body.content }] }),
        })

        if (!res.ok) {
          const text = await res.text()
          return Response.json({ error: text }, { status: res.status })
        }

        const contentType = res.headers.get("content-type") ?? ""
        if (contentType.includes("text/event-stream")) {
          return new Response(res.body, {
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
              Connection: "keep-alive",
            },
          })
        }

        return Response.json(await res.json())
      }

      case "agents": {
        const res = await fetch(`${baseUrl}/agent`)
        if (!res.ok) throw new Error(`Failed to list agents: ${res.status}`)
        const data = await res.json()
        return Response.json(data)
      }

      case "create-agent": {
        // OpenCode agents are config-based. Patch /config to add the agent definition.
        const agentConfig = body.agent
        if (!agentConfig?.name) {
          return Response.json({ error: "Agent name is required" }, { status: 400 })
        }

        // Build the agent config object for OpenCode
        const agentDef: Record<string, unknown> = {
          description: agentConfig.description ?? "",
          mode: agentConfig.mode ?? "primary",
        }
        if (agentConfig.model) agentDef.model = agentConfig.model
        if (agentConfig.prompt) agentDef.prompt = agentConfig.prompt
        if (agentConfig.temperature != null) agentDef.temperature = agentConfig.temperature
        if (agentConfig.steps != null) agentDef.steps = agentConfig.steps
        if (agentConfig.color) agentDef.color = agentConfig.color
        if (agentConfig.hidden != null) agentDef.hidden = agentConfig.hidden
        if (agentConfig.permission) agentDef.permission = agentConfig.permission

        const configPatch = { agent: { [agentConfig.name]: agentDef } }

        const res = await fetch(`${baseUrl}/config`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(configPatch),
        })

        if (!res.ok) {
          const text = await res.text()
          return Response.json({ error: `Failed to create agent: ${text}` }, { status: res.status })
        }

        const updatedConfig = await res.json()
        return Response.json({ ok: true, config: updatedConfig })
      }

      case "models": {
        const res = await fetch(`${baseUrl}/config/providers`)
        if (!res.ok) throw new Error(`Failed to list providers: ${res.status}`)
        return Response.json(await res.json())
      }

      default:
        return Response.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[opencode proxy] ${action} failed:`, message)

    if (message.includes("ECONNREFUSED") || message.includes("fetch failed") || message.includes("timeout")) {
      return Response.json(
        { error: "Cannot reach OpenCode server", details: `Tried ${baseUrl} — is \`opencode serve\` running?` },
        { status: 502 }
      )
    }

    return Response.json({ error: message }, { status: 500 })
  }
}