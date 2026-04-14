"use client"

/**
 * Plugin Store — manages installed plugins and extension registrations.
 *
 * Plugin types:
 *   "standalone"  — renders as a new tab/view
 *   "override"    — replaces a built-in view (overrides: ["chats"])
 *   "extension"   — injects UI into built-in view slots
 */

import { create } from "zustand"
import { persist } from "zustand/middleware"
import * as React from "react"

export interface PluginManifest {
  id: string
  title: string
  icon?: string
  version?: string
  description?: string
  author?: string
  // Plugin behaviour
  type?: "standalone" | "override" | "extension"
  /** For "override": which built-in view to replace */
  overrides?: string
  /** For "extension": which slot(s) to inject into */
  slots?: string[]
  entry?: string
}

export interface InstalledPlugin {
  manifest: PluginManifest
  /** True if the bundle has been compiled */
  built: boolean
  /** Loaded React component (cached after first load) */
  component?: React.ComponentType<Record<string, unknown>>
  /** Build error if last build failed */
  buildError?: string
  installedAt: number
  updatedAt: number
}

interface PluginState {
  plugins: Record<string, InstalledPlugin>

  registerPlugin: (manifest: PluginManifest) => void
  updatePlugin: (id: string, updates: Partial<InstalledPlugin>) => void
  removePlugin: (id: string) => void
  getPlugin: (id: string) => InstalledPlugin | undefined

  /** Get all plugins that extend a given slot */
  getSlotExtensions: (slotName: string) => InstalledPlugin[]
  /** Get the override plugin for a given built-in viewId, if any */
  getOverride: (viewId: string) => InstalledPlugin | undefined
  /** Get all standalone plugins */
  getStandalones: () => InstalledPlugin[]

  // Bundle loading
  loadBundle: (pluginId: string) => Promise<React.ComponentType<Record<string, unknown>>>
  clearComponentCache: (pluginId: string) => void
}

export const usePluginStore = create<PluginState>()(
  persist(
    (set, get) => ({
      plugins: {},

      registerPlugin(manifest) {
        set((s) => ({
          plugins: {
            ...s.plugins,
            [manifest.id]: {
              manifest,
              built: false,
              installedAt: s.plugins[manifest.id]?.installedAt ?? Date.now(),
              updatedAt: Date.now(),
            },
          },
        }))
      },

      updatePlugin(id, updates) {
        set((s) => {
          const existing = s.plugins[id]
          if (!existing) return s
          return {
            plugins: {
              ...s.plugins,
              [id]: { ...existing, ...updates, updatedAt: Date.now() },
            },
          }
        })
      },

      removePlugin(id) {
        set((s) => {
          const plugins = { ...s.plugins }
          delete plugins[id]
          return { plugins }
        })
      },

      getPlugin(id) {
        return get().plugins[id]
      },

      getSlotExtensions(slotName) {
        return Object.values(get().plugins).filter(
          (p) =>
            p.manifest.type === "extension" &&
            p.manifest.slots?.includes(slotName) &&
            p.built
        )
      },

      getOverride(viewId) {
        return Object.values(get().plugins).find(
          (p) => p.manifest.type === "override" && p.manifest.overrides === viewId && p.built
        )
      },

      getStandalones() {
        return Object.values(get().plugins).filter(
          (p) => !p.manifest.type || p.manifest.type === "standalone"
        )
      },

      async loadBundle(pluginId) {
        const existing = get().plugins[pluginId]
        if (existing?.component) return existing.component

        const resp = await fetch(`/api/plugins?id=${pluginId}&file=bundle`)
        if (!resp.ok) throw new Error(`Failed to load plugin bundle: ${resp.status}`)

        const code = await resp.text()
        const blob = new Blob([code], { type: "text/javascript" })
        const url = URL.createObjectURL(blob)

        try {
          const mod = await import(/* @vite-ignore */ url)
          const component = mod.default as React.ComponentType<Record<string, unknown>>
          if (!component) throw new Error("Plugin has no default export")

          set((s) => ({
            plugins: {
              ...s.plugins,
              [pluginId]: { ...s.plugins[pluginId], component },
            },
          }))

          return component
        } finally {
          URL.revokeObjectURL(url)
        }
      },

      clearComponentCache(pluginId) {
        set((s) => {
          const plugin = s.plugins[pluginId]
          if (!plugin) return s
          const { component: _, ...rest } = plugin
          return { plugins: { ...s.plugins, [pluginId]: rest } }
        })
      },
    }),
    {
      name: "studio-plugins",
      // Don't persist loaded components (they're functions, not serializable)
      partialize: (s) => ({
        plugins: Object.fromEntries(
          Object.entries(s.plugins).map(([id, p]) => {
            const { component: _, ...rest } = p
            return [id, rest]
          })
        ),
      }),
    }
  )
)
