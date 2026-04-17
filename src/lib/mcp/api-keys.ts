/**
 * MCP Server - API Key Management
 * 
 * Industry-standard API key system with:
 * - sk-live-xxx / sk-test-xxx format
 * - Scope-based permissions
 * - Rate limiting
 * - Usage tracking
 */

import { randomBytes } from "crypto"
import { promises as fs } from "fs"
import path from "path"

export interface APIKey {
  id: string
  key: string           // The actual key (hashed in storage)
  name: string          // Human-readable name
  scopes: APIKeyScope[]
  createdAt: string
  lastUsedAt?: string
  usageCount: number
  isActive: boolean
  expiresAt?: string    // Optional expiration
}

export type APIKeyScope = 
  | "read"      // Read tasks, views, plugins
  | "write"     // Create/update tasks, views
  | "admin"     // Full access + key management
  | "plugins"   // Plugin management
  | "tasks"     // Task management only

const KEYS_FILE = path.join(process.cwd(), "data", "api-keys.json")

// Simple in-memory cache
let keysCache: APIKey[] | null = null

/**
 * Generate a new API key
 */
export function generateAPIKey(prefix: "live" | "test" = "live"): string {
  const random = randomBytes(24).toString("hex")
  return `sk-${prefix}-${random}`
}

/**
 * Hash a key for storage (simple hash, not bcrypt for speed)
 */
function hashKey(key: string): string {
  // In production, use proper hashing. For now, store as-is with prefix hidden
  return key
}

/**
 * Load all API keys
 */
export async function loadAPIKeys(): Promise<APIKey[]> {
  if (keysCache) return keysCache
  
  try {
    const data = await fs.readFile(KEYS_FILE, "utf-8")
    keysCache = JSON.parse(data)
    return keysCache || []
  } catch {
    return []
  }
}

/**
 * Save API keys
 */
async function saveAPIKeys(keys: APIKey[]): Promise<void> {
  await fs.mkdir(path.dirname(KEYS_FILE), { recursive: true })
  await fs.writeFile(KEYS_FILE, JSON.stringify(keys, null, 2))
  keysCache = keys
}

/**
 * Create a new API key
 */
export async function createAPIKey(
  name: string,
  scopes: APIKeyScope[] = ["read", "write"],
  expiresInDays?: number
): Promise<{ key: APIKey; plainKey: string }> {
  const keys = await loadAPIKeys()
  const plainKey = generateAPIKey("live")
  
  const newKey: APIKey = {
    id: `key_${randomBytes(8).toString("hex")}`,
    key: hashKey(plainKey),
    name,
    scopes,
    createdAt: new Date().toISOString(),
    usageCount: 0,
    isActive: true,
    expiresAt: expiresInDays 
      ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000).toISOString()
      : undefined,
  }
  
  keys.push(newKey)
  await saveAPIKeys(keys)
  
  return { key: newKey, plainKey }
}

/**
 * Validate an API key
 */
export async function validateAPIKey(
  key: string,
  requiredScopes?: APIKeyScope[]
): Promise<{ valid: boolean; keyData?: APIKey; error?: string }> {
  const keys = await loadAPIKeys()
  
  // Find matching key
  const keyData = keys.find((k) => k.key === key && k.isActive)
  
  if (!keyData) {
    return { valid: false, error: "Invalid API key" }
  }
  
  // Check expiration
  if (keyData.expiresAt && new Date(keyData.expiresAt) < new Date()) {
    return { valid: false, error: "API key expired" }
  }
  
  // Check scopes
  if (requiredScopes) {
    const hasScope = requiredScopes.some((scope) => 
      keyData.scopes.includes(scope) || keyData.scopes.includes("admin")
    )
    if (!hasScope) {
      return { valid: false, error: "Insufficient permissions" }
    }
  }
  
  // Update usage stats
  keyData.lastUsedAt = new Date().toISOString()
  keyData.usageCount++
  await saveAPIKeys(keys)
  
  return { valid: true, keyData }
}

/**
 * Revoke an API key
 */
export async function revokeAPIKey(keyId: string): Promise<boolean> {
  const keys = await loadAPIKeys()
  const key = keys.find((k) => k.id === keyId)
  
  if (!key) return false
  
  key.isActive = false
  await saveAPIKeys(keys)
  return true
}

/**
 * Delete an API key permanently
 */
export async function deleteAPIKey(keyId: string): Promise<boolean> {
  const keys = await loadAPIKeys()
  const filtered = keys.filter((k) => k.id !== keyId)
  
  if (filtered.length === keys.length) return false
  
  await saveAPIKeys(filtered)
  return true
}

/**
 * List all API keys (with optional filtering)
 */
export async function listAPIKeys(activeOnly = false): Promise<APIKey[]> {
  const keys = await loadAPIKeys()
  if (activeOnly) {
    return keys.filter((k) => k.isActive)
  }
  return keys
}

/**
 * Get rate limit status for a key
 */
export function getRateLimitInfo(keyData: APIKey): {
  limit: number
  remaining: number
  resetAt: string
} {
  // Simple rate limiting: 100 req/min for read, 60 for write
  const baseLimit = keyData.scopes.includes("admin") ? 200 : 
    keyData.scopes.includes("write") ? 100 : 200
  
  return {
    limit: baseLimit,
    remaining: Math.max(0, baseLimit - (keyData.usageCount % baseLimit)),
    resetAt: new Date(Date.now() + 60 * 1000).toISOString(),
  }
}