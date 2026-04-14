"use client"

/**
 * PluginSlot — injection point in built-in views where plugins can add UI.
 *
 * Usage in a built-in view:
 *   import { PluginSlot } from "@/components/plugin-slot"
 *
 *   // In the JSX:
 *   <PluginSlot name="chats.sidebar" viewProps={viewProps} />
 *   <PluginSlot name="chats.toolbar" viewProps={viewProps} />
 *   <PluginSlot name="chats.message.after" viewProps={viewProps} messageId={msg.id} />
 *
 * Slot naming convention:
 *   {viewId}.{position}[.{context}]
 *   e.g. "chats.sidebar", "chats.toolbar", "kanban.card.after", "agent-manager.header"
 */

import { useEffect, useState, Component, useMemo } from "react"
import * as React from "react"
import { usePluginStore } from "@/stores/plugin-store"
import type { ViewProps } from "@/lib/types"

interface PluginSlotProps {
  /** Slot identifier, e.g. "chats.sidebar" */
  name: string
  /** Props forwarded to each slot extension */
  viewProps?: Partial<ViewProps>
  /** Additional context data for the slot */
  context?: Record<string, unknown>
  /** CSS class for the slot container */
  className?: string
}

// Error boundary for individual slot extensions
class SlotExtensionBoundary extends Component<
  { children: React.ReactNode; pluginId: string },
  { error: string | null }
> {
  state = { error: null as string | null }

  static getDerivedStateFromError(e: Error) {
    return { error: e.message }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            padding: "4px 8px",
            background: "#e06c7522",
            border: "1px solid #e06c7544",
            borderRadius: 4,
            fontSize: 11,
            color: "#e06c75",
          }}
        >
          Plugin error ({this.props.pluginId}): {this.state.error}
        </div>
      )
    }
    return this.props.children
  }
}

function SlotExtension({
  pluginId,
  viewProps,
  context,
}: {
  pluginId: string
  viewProps?: Partial<ViewProps>
  context?: Record<string, unknown>
}) {
  const loadBundle = usePluginStore((s) => s.loadBundle)
  const [Component, setComponent] = useState<React.ComponentType<Record<string, unknown>> | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadBundle(pluginId)
      .then((c) => setComponent(() => c))
      .catch((e) => setError(String(e)))
  }, [pluginId, loadBundle])

  if (error) {
    return (
      <div
        style={{
          fontSize: 11,
          color: "#e06c75",
          padding: "2px 6px",
        }}
      >
        ⚠ {error}
      </div>
    )
  }

  if (!Component) return null

  return (
    <SlotExtensionBoundary pluginId={pluginId}>
      <Component {...(viewProps as Record<string, unknown>)} {...(context ?? {})} />
    </SlotExtensionBoundary>
  )
}

/**
 * Renders all extension plugins registered for a given slot name.
 * Returns null (renders nothing) if no plugins target this slot.
 */
export function PluginSlot({ name, viewProps, context, className }: PluginSlotProps) {
  const getSlotExtensions = usePluginStore((s) => s.getSlotExtensions)
  // Memoize to prevent infinite re-renders when the selector returns a new array
  const extensions = useMemo(() => getSlotExtensions(name), [getSlotExtensions, name])

  if (extensions.length === 0) return null

  return (
    <div className={className} data-plugin-slot={name}>
      {extensions.map((ext) => (
        <SlotExtension
          key={ext.manifest.id}
          pluginId={ext.manifest.id}
          viewProps={viewProps}
          context={context}
        />
      ))}
    </div>
  )
}
