"use client"

import { useEffect } from "react"
import { useTabStore } from "@/stores/tab-store"
import { useOrchestratorStore } from "@/stores/orchestrator-store"

/**
 * Global keyboard shortcuts for Studio.
 *
 * Ctrl/Cmd+T — New tab
 * Ctrl/Cmd+W — Close current tab
 * Ctrl/Cmd+1-9 — Switch to tab by index
 * Ctrl/Cmd+Shift+] — Next tab
 * Ctrl/Cmd+Shift+[ — Previous tab
 */
export function useKeyboardShortcuts() {
  const openTab = useTabStore((s) => s.openTab)
  const closeTab = useTabStore((s) => s.closeTab)
  const setActiveTab = useTabStore((s) => s.setActiveTab)
  const tabs = useTabStore((s) => s.tabs)
  const activeTabId = useTabStore((s) => s.activeTabId)
  const toggleOrchestrator = useOrchestratorStore((s) => s.toggle)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return

      // Ctrl+Shift+O — toggle orchestrator sidebar
      if (e.key === "o" && e.shiftKey) {
        e.preventDefault()
        toggleOrchestrator()
        return
      }

      // Ctrl+T — new tab
      if (e.key === "t") {
        e.preventDefault()
        const existing = tabs.find((t) => t.viewId === "view-picker")
        if (existing) {
          setActiveTab(existing.id)
        } else {
          openTab("view-picker", "New Tab", "layout-grid")
        }
        return
      }

      // Ctrl+W — close current tab
      if (e.key === "w") {
        e.preventDefault()
        if (activeTabId && tabs.length > 1) {
          closeTab(activeTabId)
        }
        return
      }

      // Ctrl+1-9 — switch to tab by index
      const num = parseInt(e.key)
      if (num >= 1 && num <= 9) {
        e.preventDefault()
        const idx = num === 9 ? tabs.length - 1 : num - 1
        if (idx < tabs.length) {
          setActiveTab(tabs[idx].id)
        }
        return
      }

      // Ctrl+Shift+] — next tab
      if (e.key === "]" && e.shiftKey) {
        e.preventDefault()
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        if (idx >= 0 && idx < tabs.length - 1) {
          setActiveTab(tabs[idx + 1].id)
        }
        return
      }

      // Ctrl+Shift+[ — previous tab
      if (e.key === "[" && e.shiftKey) {
        e.preventDefault()
        const idx = tabs.findIndex((t) => t.id === activeTabId)
        if (idx > 0) {
          setActiveTab(tabs[idx - 1].id)
        }
        return
      }
    }

    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [openTab, closeTab, setActiveTab, tabs, activeTabId, toggleOrchestrator])
}
