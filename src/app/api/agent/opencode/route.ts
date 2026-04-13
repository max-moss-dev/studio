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
 * - { action: "abort", sessionId }              → abort session
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
        // Stream the response back as SSE
        const res = await fetch(`${baseUrl}/session/${body.sessionId}/message`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: body.content }),
        })

        if (!res.ok) {
          const text = await res.text()
          return Response.json({ error: text }, { status: res.status })
        }

        // Return the response directly (may be streaming or JSON)
        const contentType = res.headers.get("content-type") ?? ""
        if (contentType.includes("text/event-stream")) {
          // Forward SSE stream
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
