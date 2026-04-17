import { NextRequest } from "next/server"

/**
 * POST /api/ollama/chat
 * 
 * Proxy for Ollama streaming chat API with tool support.
 * Expects OllamaChatRequest body and returns SSE stream.
 */

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { messages, tools, model, stream = true, options } = body

  // Get Ollama URL from request headers or use default
  const ollamaUrl = request.headers.get("x-ollama-url") || "http://localhost:11434"
  const apiKey = request.headers.get("x-ollama-api-key")

  try {
    const res = await fetch(`${ollamaUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey && { Authorization: `Bearer ${apiKey}` }),
      },
      body: JSON.stringify({
        model: model || "kimi-k2.5:cloud",
        messages,
        tools,
        stream,
        ...(options && { options }),
      }),
    })

    if (!res.ok) {
      const text = await res.text()
      return Response.json(
        { error: `Ollama error: ${res.status} ${text}` },
        { status: res.status }
      )
    }

    // If not streaming, return JSON response
    if (!stream) {
      const data = await res.json()
      return Response.json(data)
    }

    // Return SSE stream
    return new Response(res.body, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    
    if (message.includes("ECONNREFUSED") || message.includes("Failed to fetch")) {
      return Response.json(
        { 
          error: "Cannot connect to Ollama", 
          details: `Tried ${ollamaUrl}. Is Ollama running?`,
          code: "ECONNREFUSED"
        },
        { status: 502 }
      )
    }

    return Response.json(
      { error: message },
      { status: 500 }
    )
  }
}