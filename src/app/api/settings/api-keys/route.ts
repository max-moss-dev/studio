/**
 * API Keys Management API
 * 
 * POST /api/settings/api-keys - Create new key
 * GET /api/settings/api-keys - List all keys
 * DELETE /api/settings/api-keys - Revoke/delete key
 */

import { NextRequest } from "next/server"
import {
  createAPIKey,
  revokeAPIKey,
  deleteAPIKey,
  listAPIKeys,
  APIKeyScope,
} from "@/lib/mcp/api-keys"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, scopes, expiresInDays } = body as {
      name: string
      scopes: APIKeyScope[]
      expiresInDays?: number
    }

    if (!name) {
      return Response.json({ error: "Name is required" }, { status: 400 })
    }

    const { key, plainKey } = await createAPIKey(name, scopes, expiresInDays)

    return Response.json({
      key,
      plainKey,
      message: "API key created successfully",
    })
  } catch (err) {
    console.error("[API Keys] Failed to create:", err)
    return Response.json(
      { error: "Failed to create API key" },
      { status: 500 }
    )
  }
}

export async function GET() {
  try {
    const keys = await listAPIKeys()
    return Response.json({ keys })
  } catch (err) {
    console.error("[API Keys] Failed to list:", err)
    return Response.json(
      { error: "Failed to list API keys" },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const { keyId, permanent } = body as {
      keyId: string
      permanent?: boolean
    }

    if (!keyId) {
      return Response.json({ error: "Key ID is required" }, { status: 400 })
    }

    if (permanent) {
      await deleteAPIKey(keyId)
    } else {
      await revokeAPIKey(keyId)
    }

    return Response.json({ success: true })
  } catch (err) {
    console.error("[API Keys] Failed to delete:", err)
    return Response.json(
      { error: "Failed to delete API key" },
      { status: 500 }
    )
  }
}
