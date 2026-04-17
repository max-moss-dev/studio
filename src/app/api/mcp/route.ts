/**
 * MCP Server - Main Endpoint
 * 
 * POST /api/mcp
 * 
 * Implements MCP 2025-06 specification with JSON-RPC 2.0
 * Authentication: Bearer token in Authorization header
 */

import { NextRequest } from "next/server"
import { z } from "zod"
import { getAllTools, executeTool } from "@/lib/mcp/tools"
import { loadAPIKeys } from "@/lib/mcp/api-keys"

// MCP Protocol Version
const MCP_VERSION = "2025-06"

interface JSONRPCRequest {
  jsonrpc: "2.0"
  id: string | number | null
  method: string
  params?: unknown
}

interface JSONRPCResponse {
  jsonrpc: "2.0"
  id: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

// Error codes per MCP spec
const ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  UNAUTHORIZED: -32001,
  RATE_LIMITED: -32002,
}

export async function POST(request: NextRequest) {
  // Extract API key from Authorization header
  const authHeader = request.headers.get("authorization")
  const apiKey = authHeader?.startsWith("Bearer ") 
    ? authHeader.slice(7) 
    : null

  if (!apiKey) {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: ERROR_CODES.UNAUTHORIZED,
          message: "Missing API key. Use: Authorization: Bearer <key>",
        },
      } as JSONRPCResponse,
      { status: 401 }
    )
  }

  let body: JSONRPCRequest

  try {
    body = await request.json()
  } catch {
    return Response.json(
      {
        jsonrpc: "2.0",
        id: null,
        error: {
          code: ERROR_CODES.PARSE_ERROR,
          message: "Invalid JSON",
        },
      } as JSONRPCResponse,
      { status: 400 }
    )
  }

  const { id, method, params } = body

  // Handle MCP methods
  try {
    switch (method) {
      case "initialize": {
        const result = {
          protocolVersion: MCP_VERSION,
          capabilities: {
            tools: { listChanged: true },
            resources: { subscribe: false },
            prompts: { listChanged: false },
          },
          serverInfo: {
            name: "studio-mcp-server",
            version: "1.0.0",
          },
        }
        return Response.json({ jsonrpc: "2.0", id, result } as JSONRPCResponse)
      }

      case "tools/list": {
        const tools = getAllTools().map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema instanceof z.ZodType 
            ? zodToJsonSchema(tool.inputSchema)
            : tool.inputSchema,
        }))
        
        return Response.json({
          jsonrpc: "2.0",
          id,
          result: { tools },
        } as JSONRPCResponse)
      }

      case "tools/call": {
        const { name, arguments: toolParams } = params as {
          name: string
          arguments?: Record<string, unknown>
        }

        if (!name) {
          return Response.json({
            jsonrpc: "2.0",
            id,
            error: {
              code: ERROR_CODES.INVALID_PARAMS,
              message: "Tool name is required",
            },
          } as JSONRPCResponse)
        }

        const result = await executeTool(name, toolParams || {}, apiKey, request)
        
        return Response.json({
          jsonrpc: "2.0",
          id,
          result: {
            content: result.success
              ? [{ type: "text", text: JSON.stringify(result.data, null, 2) }]
              : [{ type: "text", text: result.error }],
            isError: !result.success,
            meta: result.meta,
          },
        } as JSONRPCResponse)
      }

      case "ping": {
        return Response.json({
          jsonrpc: "2.0",
          id,
          result: {},
        } as JSONRPCResponse)
      }

      default:
        return Response.json({
          jsonrpc: "2.0",
          id,
          error: {
            code: ERROR_CODES.METHOD_NOT_FOUND,
            message: `Method "${method}" not found`,
          },
        } as JSONRPCResponse)
    }
  } catch (err) {
    console.error("[MCP] Error:", err)
    return Response.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: err instanceof Error ? err.message : "Internal error",
      },
    } as JSONRPCResponse)
  }
}

// GET - Server info and health check
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization")
  const apiKey = authHeader?.startsWith("Bearer ") 
    ? authHeader.slice(7) 
    : null

  // Load keys to check if any exist
  const keys = await loadAPIKeys()
  const activeKeys = keys.filter((k) => k.isActive)

  return Response.json({
    name: "Studio MCP Server",
    version: "1.0.0",
    protocol: MCP_VERSION,
    status: "healthy",
    authenticated: !!apiKey,
    keysConfigured: activeKeys.length,
    endpoints: {
      rpc: "/api/mcp",
      sse: "/api/sse",
    },
  })
}

// Helper: Convert Zod schema to JSON Schema
function zodToJsonSchema(zodType: z.ZodType): Record<string, unknown> {
  // This is a simplified version - in production use zod-to-json-schema
  return {
    type: "object",
    properties: {},
  }
}