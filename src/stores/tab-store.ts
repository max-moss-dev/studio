"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Tab } from "@/lib/types"

interface TabState {
  tabs: Tab[]
  activeTabId: string | null
  openTab: (viewId: string, title: string, icon?: string) => string
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTabState: (id: string, state: Record<string, unknown>) => void
}

let tabCounter = 0

export const useTabStore = create<TabState>()(
  persist(
    (set, get) => ({
      tabs: [
        {
          id: "tab-agents-default",
          viewId: "agent-manager",
          title: "Agents",
          icon: "bot",
        },
      ],
      activeTabId: "tab-agents-default",

      openTab(viewId: string, title: string, icon?: string) {
        const id = `tab-${Date.now()}-${++tabCounter}`
        const newTab: Tab = { id, viewId, title, icon }
        set((s) => ({
          tabs: [...s.tabs, newTab],
          activeTabId: id,
        }))
        return id
      },

      closeTab(id: string) {
        const { tabs, activeTabId } = get()
        if (tabs.length <= 1) return // Keep at least one tab

        const idx = tabs.findIndex((t) => t.id === id)
        const newTabs = tabs.filter((t) => t.id !== id)
        let newActive = activeTabId

        if (activeTabId === id) {
          // Activate adjacent tab
          const newIdx = Math.min(idx, newTabs.length - 1)
          newActive = newTabs[newIdx]?.id ?? null
        }

        set({ tabs: newTabs, activeTabId: newActive })
      },

      setActiveTab(id: string) {
        set({ activeTabId: id })
      },

      updateTabState(id: string, state: Record<string, unknown>) {
        set((s) => ({
          tabs: s.tabs.map((t) =>
            t.id === id ? { ...t, state: { ...t.state, ...state } } : t
          ),
        }))
      },
    }),
    {
      name: "openclaw-tabs",
    }
  )
)
