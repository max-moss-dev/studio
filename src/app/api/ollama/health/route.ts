import { NextRequest } from "next/server"

/**
 * GET /api/ollama/health
 * 
 * Health check endpoint for Ollama connection.
 * Returns version info if Ollama is reachable.
 */

export async function GET(request: NextRequest) {
  const ollamaUrl = request.headers.get("x-ollama-url") || "http://localhost:11434"
  const apiKey = request.headers.get("x-ollama-api-key")

  try {
    const res = await fetch(`${ollamaUrl}/api/version`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(5000),
    })

    if (!res.ok) {
      return Response.json(
        { 
          ok: false, 
          error: `HTTP ${res.status}: ${res.statusText}`,
          version: null 
        },
        { status: res.status }
      )
    }

    const data = await res.json()
    return Response.json({
      ok: true,
      version: data.version,
      error: null
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    
    if (message.includes("ECONNREFUSED") || message.includes("Failed to fetch")) {
      return Response.json(
        { 
          ok: false, 
          error: "Cannot connect to Ollama. Is it running?",
          code: "ECONNREFUSED",
          version: null
        },
        { status: 502 }
      )
    }

    return Response.json(
      { 
        ok: false, 
        error: message,
        version: null 
      },
      { status: 500 }
    )
  }
}