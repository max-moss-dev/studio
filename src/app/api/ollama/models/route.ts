import { NextRequest } from "next/server"

/**
 * GET /api/ollama/models
 * 
 * List available models from Ollama (/api/tags).
 */

export async function GET(request: NextRequest) {
  const ollamaUrl = request.headers.get("x-ollama-url") || "http://localhost:11434"
  const apiKey = request.headers.get("x-ollama-api-key")

  try {
    const res = await fetch(`${ollamaUrl}/api/tags`, {
      headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      signal: AbortSignal.timeout(10000),
    })

    if (!res.ok) {
      const text = await res.text()
      return Response.json(
        { error: `Ollama error: ${res.status} ${text}` },
        { status: res.status }
      )
    }

    const data = await res.json()
    return Response.json(data)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    
    if (message.includes("ECONNREFUSED") || message.includes("Failed to fetch")) {
      return Response.json(
        { 
          error: "Cannot connect to Ollama", 
          details: `Tried ${ollamaUrl}. Is Ollama running?`,
          code: "ECONNREFUSED",
          models: []
        },
        { status: 502 }
      )
    }

    return Response.json(
      { error: message, models: [] },
      { status: 500 }
    )
  }
}