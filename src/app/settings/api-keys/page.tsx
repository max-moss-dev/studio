/**
 * API Key Management Settings Page
 * 
 * Allows users to create, view, and revoke API keys for MCP access
 */

"use client"

import { useState, useEffect } from "react"
import { Key, Plus, Trash2, Copy, Check, AlertCircle, Shield } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Alert,
  AlertDescription,
} from "@/components/ui/alert"
import type { APIKey, APIKeyScope } from "@/lib/mcp/api-keys"

const SCOPES: { id: APIKeyScope; label: string; description: string }[] = [
  { id: "read", label: "Read", description: "View tasks, plugins, and views" },
  { id: "write", label: "Write", description: "Create and update resources" },
  { id: "tasks", label: "Tasks", description: "Task management only" },
  { id: "plugins", label: "Plugins", description: "Plugin management" },
  { id: "admin", label: "Admin", description: "Full access + key management" },
]

export default function APIKeysSettings() {
  const [keys, setKeys] = useState<APIKey[]>([])
  const [loading, setLoading] = useState(true)
  const [newKeyName, setNewKeyName] = useState("")
  const [selectedScopes, setSelectedScopes] = useState<APIKeyScope[]>(["read", "write"])
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  useEffect(() => {
    loadKeys()
  }, [])

  async function loadKeys() {
    try {
      const response = await fetch("/api/settings/api-keys")
      const data = await response.json()
      setKeys(data.keys || [])
    } catch (err) {
      console.error("Failed to load keys:", err)
    } finally {
      setLoading(false)
    }
  }

  async function createKey() {
    try {
      const response = await fetch("/api/settings/api-keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newKeyName, scopes: selectedScopes }),
      })
      
      const data = await response.json()
      
      if (data.plainKey) {
        setGeneratedKey(data.plainKey)
        setKeys((prev) => [...prev, data.key])
      }
    } catch (err) {
      console.error("Failed to create key:", err)
    }
  }

  async function revokeKey(keyId: string) {
    if (!confirm("Are you sure you want to revoke this key? This cannot be undone.")) {
      return
    }
    
    try {
      await fetch("/api/settings/api-keys", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyId }),
      })
      
      setKeys((prev) => prev.map((k) => 
        k.id === keyId ? { ...k, isActive: false } : k
      ))
    } catch (err) {
      console.error("Failed to revoke key:", err)
    }
  }

  function copyKey(key: string) {
    navigator.clipboard.writeText(key)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function toggleScope(scope: APIKeyScope) {
    setSelectedScopes((prev) =>
      prev.includes(scope)
        ? prev.filter((s) => s !== scope)
        : [...prev, scope]
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold flex items-center gap-2">
            <Key className="h-6 w-6 text-[#61afef]" />
            API Keys
          </h2>
          <p className="text-muted-foreground mt-1">
            Manage API keys for MCP server access
          </p>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Create Key
            </Button>
          </DialogTrigger>
          
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Create API Key</DialogTitle>
              <DialogDescription>
                Generate a new API key for external agent access
              </DialogDescription>
            </DialogHeader>
            
            {!generatedKey ? (
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Key Name</label>
                  <Input
                    placeholder="e.g., VPS Claude Code"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium">Permissions</label>
                  <div className="space-y-2">
                    {SCOPES.map((scope) => (
                      <label
                        key={scope.id}
                        className="flex items-start gap-3 p-3 rounded-lg border cursor-pointer hover:bg-muted/50"
                      >
                        <input
                          type="checkbox"
                          checked={selectedScopes.includes(scope.id)}
                          onChange={() => toggleScope(scope.id)}
                          className="mt-1"
                        />
                        <div>
                          <p className="font-medium text-sm">{scope.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {scope.description}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
                
                <Button
                  onClick={createKey}
                  disabled={!newKeyName || selectedScopes.length === 0}
                  className="w-full"
                >
                  Generate Key
                </Button>
              </div>
            ) : (
              <div className="space-y-4 py-4">
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    Copy this key now. It will not be shown again!
                  </AlertDescription>
                </Alert>
                
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-muted p-3 rounded text-sm font-mono break-all">
                    {generatedKey}
                  </code>
                  <Button
                    size="icon"
                    variant="outline"
                    onClick={() => copyKey(generatedKey)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                
                <Button
                  onClick={() => {
                    setGeneratedKey(null)
                    setNewKeyName("")
                    setSelectedScopes(["read", "write"])
                    setShowCreateDialog(false)
                  }}
                  className="w-full"
                >
                  Done
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>

      {/* Keys List */}
      <div className="space-y-4">
        {loading ? (
          <p className="text-muted-foreground">Loading keys...</p>
        ) : keys.length === 0 ? (
          <div className="text-center py-12 border rounded-lg">
            <Shield className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No API keys yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Create a key to allow external agents to connect
            </p>
          </div>
        ) : (
          keys.map((key) => (
            <div
              key={key.id}
              className={`flex items-center justify-between p-4 border rounded-lg ${
                !key.isActive ? "opacity-60 bg-muted" : ""
              }`}
            >
              <div className="flex items-center gap-4">
                <div className="h-10 w-10 rounded-full bg-[#61afef]/10 flex items-center justify-center"
003e
                  <Key className="h-5 w-5 text-[#61afef]" />
                </div>
                
                <div>
                  <p className="font-medium">{key.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {key.id} • Created {new Date(key.createdAt).toLocaleDateString()}
                  </p>
                  <div className="flex items-center gap-1 mt-1">
                    {key.scopes.map((scope) => (
                      <Badge
                        key={scope}
                        variant="secondary"
                        className="text-[10px]"
                      >
                        {scope}
                      </Badge>
                    ))}
                    {!key.isActive && (
                      <Badge variant="destructive" className="text-[10px]">
                        Revoked
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              
              {key.isActive && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => revokeKey(key.id)}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Usage Info */}
      <Alert>
        <Shield className="h-4 w-4" />
        <AlertDescription>
          Use your API key with:
          <code className="bg-muted px-1 py-0.5 rounded text-xs">
            Authorization: Bearer <your-key>
          </code>
          in requests to <code className="text-xs">/api/mcp</code>
        </AlertDescription>
      </Alert>
    </div>
  )
}
