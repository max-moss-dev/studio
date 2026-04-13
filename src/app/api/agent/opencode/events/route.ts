import { NextRequest } from "next/server"

/**
 * GET /api/agent/opencode/events
 *
 * Proxy SSE event stream from OpenCode server.
 * Studio subscribes to this to get real-time session updates.
 */

export async function GET(request: NextRequest) {
  const baseUrl = request.headers.get("x-opencode-url") || "http://localhost:4096"

  try {
    const res = await fetch(`${baseUrl}/event`, {
      headers: { Accept: "text/event-stream" },
    })

    if (!res.ok || !res.body) {
      return Response.json({ error: `OpenCode events failed: ${res.status}` }, { status: res.status })
    }

    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (err) {
    return Response.json(
      { error: "Cannot reach OpenCode server" },
      { status: 502 }
    )
  }
}
