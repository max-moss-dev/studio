"use client"

import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { Tab } from "@/lib/types"

interface TabState {
  tabs: Tab[]
  activeTabId: string | null
  openTab: (viewId: string, title: string, icon?: string, initialState?: Record<string, unknown>) => string
  closeTab: (id: string) => void
  closeOtherTabs: (id: string) => void
  setActiveTab: (id: string) => void
  updateTabState: (id: string, state: Record<string, unknown>) => void
  reorderTabs: (fromIndex: number, toIndex: number) => void
  duplicateTab: (id: string) => string | null
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

      openTab(viewId: string, title: string, icon?: string, initialState?: Record<string, unknown>) {
        const id = `tab-${Date.now()}-${++tabCounter}`
        const newTab: Tab = { id, viewId, title, icon, state: initialState }
        set((s) => ({
          tabs: [...s.tabs, newTab],
          activeTabId: id,
        }))
        return id
      },

      closeTab(id: string) {
        const { tabs, activeTabId } = get()
        if (tabs.length <= 1) return

        const idx = tabs.findIndex((t) => t.id === id)
        const newTabs = tabs.filter((t) => t.id !== id)
        let newActive = activeTabId

        if (activeTabId === id) {
          const newIdx = Math.min(idx, newTabs.length - 1)
          newActive = newTabs[newIdx]?.id ?? null
        }

        set({ tabs: newTabs, activeTabId: newActive })
      },

      closeOtherTabs(id: string) {
        const { tabs } = get()
        const tab = tabs.find((t) => t.id === id)
        if (!tab) return
        set({ tabs: [tab], activeTabId: id })
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

      reorderTabs(fromIndex: number, toIndex: number) {
        set((s) => {
          const tabs = [...s.tabs]
          const [moved] = tabs.splice(fromIndex, 1)
          tabs.splice(toIndex, 0, moved)
          return { tabs }
        })
      },

      duplicateTab(id: string) {
        const tab = get().tabs.find((t) => t.id === id)
        if (!tab) return null
        return get().openTab(tab.viewId, tab.title, tab.icon, tab.state)
      },
    }),
    {
      name: "openclaw-tabs",
    }
  )
)
