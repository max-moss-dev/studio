/**
 * MCP (Model Context Protocol) Types
 * 
 * Based on MCP 2025-06 specification
 * Supports JSON-RPC 2.0 over HTTP with Server-Sent Events
 */

// MCP Protocol Version
export const MCP_VERSION = "2025-06"

// Standard JSON-RPC request
export interface JSONRPCRequest {
  jsonrpc: "2.0"
  id: string | number | null
  method: string
  params?: unknown
}

// Standard JSON-RPC response
export interface JSONRPCResponse {
  jsonrpc: "2.0"
  id: string | number | null
  result?: unknown
  error?: {
    code: number
    message: string
    data?: unknown
  }
}

// MCP Tool definition
export interface MCPTool {
  name: string
  description: string
  inputSchema: {
    type: "object"
    properties: Record<string, unknown>
    required?: string[]
    additionalProperties?: boolean
  }
}

// MCP Capability advertisement
export interface ServerCapabilities {
  tools: {
    listChanged: boolean
  }
  // Future: resources, prompts, etc.
}

// MCP Initialize request/response
export interface InitializeRequest {
  protocolVersion: string
  capabilities: {
    tools?: { listChanged?: boolean }
  }
  clientInfo: {
    name: string
    version: string
  }
}

export interface InitializeResponse {
  protocolVersion: string
  capabilities: ServerCapabilities
  serverInfo: {
    name: string
    version: string
  }
}

// Tool call request
export interface CallToolRequest {
  name: string
  arguments?: Record<string, unknown>
}

// Tool call result
export interface CallToolResult {
  content: Array<{
    type: "text" | "image" | "resource"
    text?: string
    data?: string
    mimeType?: string
  }>
  isError?: boolean
}

// SSE Event types
export interface SSEEvent {
  event: string
  data: string
}

// Authentication for Ed25519
export interface AuthBlock {
  deviceId: string
  clientId: string
  role: string
  scopes: string[]
  issuedAt: number
  expiresAt: number
  nonce: string
}

export interface SignedRequest {
  auth: AuthBlock
  signature: string  // base64-encoded Ed25519 signature
}
