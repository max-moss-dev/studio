"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { useViewStore } from "@/stores/view-store"
import { useTabStore } from "@/stores/tab-store"
import { Save, Play, RotateCw, Code } from "lucide-react"

export default function CodeEditorView({ viewId }: { viewId?: string }) {
  const views = useViewStore((s) => s.views)
  const registerView = useViewStore((s) => s.registerView)
  const openTab = useTabStore((s) => s.openTab)

  const view = viewId ? views.find((v) => v.id === viewId) : null
  const [code, setCode] = useState(view?.code ?? "")
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (view?.code && !code) {
      setCode(view.code)
    }
  }, [view, code])

  async function handleSave() {
    if (!view) return
    // Save to disk
    try {
      await fetch("/api/views", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: view.id, code }),
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (err) {
      console.error("Save failed:", err)
    }
  }

  function handlePreview() {
    if (!view) return
    handleSave().then(() => {
      openTab(view.id, view.title, view.icon)
    })
  }

  if (!view) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <Code className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No view selected for editing</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Code className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium flex-1">{view.title}</span>
        <span className="text-xs text-muted-foreground mr-2">
          {view.type === "ai-generated" ? "Editable" : view.type}
        </span>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handleSave}
        >
          <Save className="h-3 w-3" />
          {saved ? "Saved!" : "Save"}
        </Button>
        <Button
          size="sm"
          className="h-7 gap-1.5 text-xs"
          onClick={handlePreview}
        >
          <Play className="h-3 w-3" />
          Preview
        </Button>
      </div>

      {/* Editor */}
      <textarea
        value={code}
        onChange={(e) => setCode(e.target.value)}
        className="flex-1 p-4 bg-bg-base text-text-primary resize-none font-mono text-sm leading-relaxed focus:outline-none"
        spellCheck={false}
      />
    </div>
  )
}
