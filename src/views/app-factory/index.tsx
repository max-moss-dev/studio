"use client"

import { useEffect, useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, FileCode2, FolderPlus, Loader2, RefreshCw, Server, Wrench } from "lucide-react"

interface AppWorkspaceSummary {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
  entry: string
  fileCount: number
  files: string[]
  mcp: {
    serverName: string
    endpoint: string
    tools: string[]
  }
}

export default function AppFactoryView() {
  const [apps, setApps] = useState<AppWorkspaceSummary[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState("New AI App")
  const [description, setDescription] = useState("A generated app workspace that agents can edit through MCP tools.")
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const selected = useMemo(
    () => apps.find((app) => app.id === selectedId) ?? apps[0] ?? null,
    [apps, selectedId]
  )

  async function refresh() {
    setLoading(true)
    try {
      const res = await fetch("/api/apps", { cache: "no-store" })
      const data = await res.json()
      setApps(data.apps ?? [])
    } finally {
      setLoading(false)
    }
  }

  async function createApp() {
    if (!name.trim()) return
    setCreating(true)
    try {
      const res = await fetch("/api/apps", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          name: name.trim(),
          description: description.trim(),
          initialFiles: {
            "README.md": `# ${name.trim()}\n\n${description.trim()}\n`,
            "src/app.tsx": `export default function App() {\n  return <main>${name.trim()}</main>\n}\n`,
          },
        }),
      })
      const data = await res.json()
      if (data.app) {
        setApps((current) => [data.app, ...current.filter((app) => app.id !== data.app.id)])
        setSelectedId(data.app.id)
      }
    } finally {
      setCreating(false)
    }
  }

  async function copyMcpConfig(app: AppWorkspaceSummary) {
    const origin = window.location.origin
    const config = {
      mcpServers: {
        [app.mcp.serverName]: {
          url: `${origin}${app.mcp.endpoint}`,
          note: "HTTP JSON-RPC MCP endpoint for this Studio-generated app workspace",
        },
      },
    }
    await navigator.clipboard.writeText(JSON.stringify(config, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  useEffect(() => {
    refresh()
  }, [])

  return (
    <div className="h-full overflow-auto bg-[#282c34] p-6 text-[#abb2bf]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <section className="rounded-xl border border-[#3e4451] bg-[#2c313a] p-5 shadow-lg">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <Server className="h-6 w-6 text-[#61afef]" />
                <h1 className="text-xl font-semibold text-[#dcdfe4]">MCP App Factory</h1>
              </div>
              <p className="mt-2 max-w-3xl text-sm text-[#abb2bf]">
                Create isolated app workspaces that behave like app-scoped MCP servers. External AI agents can call Studio tools to create apps, then use each app endpoint to list, read, and write that app&apos;s files.
              </p>
            </div>
            <Button variant="outline" onClick={refresh} disabled={loading}>
              {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
          <section className="rounded-xl border border-[#3e4451] bg-[#2c313a] p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[#dcdfe4]">
              <FolderPlus className="h-4 w-4 text-[#98c379]" /> Create app
            </h2>
            <div className="flex flex-col gap-3">
              <label className="text-xs text-[#abb2bf]">
                Name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 w-full rounded-md border border-[#3e4451] bg-[#1e2127] px-3 py-2 text-sm text-[#dcdfe4] outline-none focus:border-[#61afef]"
                />
              </label>
              <label className="text-xs text-[#abb2bf]">
                Description
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={4}
                  className="mt-1 w-full rounded-md border border-[#3e4451] bg-[#1e2127] px-3 py-2 text-sm text-[#dcdfe4] outline-none focus:border-[#61afef]"
                />
              </label>
              <Button onClick={createApp} disabled={creating || !name.trim()}>
                {creating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FolderPlus className="mr-2 h-4 w-4" />}
                Create MCP app
              </Button>
            </div>

            <h2 className="mb-3 mt-6 text-sm font-semibold uppercase tracking-wide text-[#dcdfe4]">Apps</h2>
            <div className="flex flex-col gap-2">
              {apps.length === 0 && (
                <div className="rounded-lg border border-dashed border-[#3e4451] p-4 text-sm text-[#7f848e]">
                  No app workspaces yet.
                </div>
              )}
              {apps.map((app) => (
                <button
                  key={app.id}
                  onClick={() => setSelectedId(app.id)}
                  className={`rounded-lg border p-3 text-left transition-colors ${selected?.id === app.id ? "border-[#61afef] bg-[#1e2127]" : "border-[#3e4451] hover:bg-[#333842]"}`}
                >
                  <div className="font-medium text-[#dcdfe4]">{app.name}</div>
                  <div className="mt-1 text-xs text-[#7f848e]">{app.id} · {app.fileCount} files</div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-[#3e4451] bg-[#2c313a] p-5">
            {selected ? (
              <div className="flex flex-col gap-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-[#dcdfe4]">{selected.name}</h2>
                    <p className="mt-1 text-sm text-[#abb2bf]">{selected.description || "No description."}</p>
                    <p className="mt-2 font-mono text-xs text-[#7f848e]">{selected.mcp.endpoint}</p>
                  </div>
                  <Button variant="outline" onClick={() => copyMcpConfig(selected)}>
                    <Copy className="mr-2 h-4 w-4" />
                    {copied ? "Copied" : "Copy MCP config"}
                  </Button>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[#3e4451] bg-[#1e2127] p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#dcdfe4]">
                      <Wrench className="h-4 w-4 text-[#e5c07b]" /> App-scoped tools
                    </h3>
                    <ul className="space-y-2 font-mono text-xs text-[#abb2bf]">
                      {selected.mcp.tools.map((tool) => <li key={tool}>{tool}</li>)}
                    </ul>
                  </div>
                  <div className="rounded-lg border border-[#3e4451] bg-[#1e2127] p-4">
                    <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-[#dcdfe4]">
                      <FileCode2 className="h-4 w-4 text-[#c678dd]" /> Files
                    </h3>
                    <ul className="max-h-52 space-y-2 overflow-auto font-mono text-xs text-[#abb2bf]">
                      {selected.files.map((file) => <li key={file}>{file}</li>)}
                    </ul>
                  </div>
                </div>

                <div className="rounded-lg border border-[#3e4451] bg-[#1e2127] p-4">
                  <h3 className="mb-2 text-sm font-medium text-[#dcdfe4]">Global Studio MCP tools</h3>
                  <p className="text-sm text-[#abb2bf]">
                    Use <code className="rounded bg-[#282c34] px-1 py-0.5">studio.apps.create</code>, <code className="rounded bg-[#282c34] px-1 py-0.5">studio.apps.files.read</code>, and <code className="rounded bg-[#282c34] px-1 py-0.5">studio.apps.files.write</code> through <code className="rounded bg-[#282c34] px-1 py-0.5">/api/mcp</code> for cross-app orchestration. Use this app&apos;s endpoint for isolated per-app tooling.
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex h-72 items-center justify-center text-sm text-[#7f848e]">
                Create or select an app to inspect its MCP endpoint.
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
