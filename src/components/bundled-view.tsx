"use client"

/**
 * BundledView — loads and renders a compiled plugin bundle.
 *
 * Used in app-shell for "plugin" type views (built via esbuild).
 * The bundle is a self-contained ESM module with React + store shims.
 */

import { useEffect, useState, Component } from "react"
import * as React from "react"
import { usePluginStore } from "@/stores/plugin-store"
import { AlertTriangle, RotateCw, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ViewProps, GatewayMessage } from "@/lib/types"

interface BundledViewProps {
  pluginId: string
  viewProps: Omit<ViewProps, "send">
  onSend?: (msg: GatewayMessage) => void
  onError?: (error: string) => void
}

// Runtime error boundary
class BundledViewBoundary extends Component<
  { children: React.ReactNode; onError?: (e: string) => void },
  { error: string | null }
> {
  state = { error: null as string | null }

  static getDerivedStateFromError(e: Error) {
    return { error: e.message }
  }

  componentDidCatch(e: Error) {
    this.props.onError?.(e.message)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
          <AlertTriangle className="h-8 w-8 text-[#e06c75]" />
          <p className="text-sm font-medium text-[#e06c75]">Plugin Runtime Error</p>
          <pre className="text-xs text-muted-foreground max-w-2xl w-full overflow-auto bg-[#2c313a] p-3 rounded whitespace-pre-wrap border border-[#e06c75]/20">
            {this.state.error}
          </pre>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ error: null })}
            className="gap-1.5"
          >
            <RotateCw className="h-3 w-3" />
            Retry
          </Button>
        </div>
      )
    }
    return this.props.children
  }
}

export function BundledView({ pluginId, viewProps, onSend, onError }: BundledViewProps) {
  const loadBundle = usePluginStore((s) => s.loadBundle)
  const plugin = usePluginStore((s) => s.plugins[pluginId])
  const [PluginComponent, setPluginComponent] =
    useState<React.ComponentType<Record<string, unknown>> | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setLoadError(null)

    loadBundle(pluginId)
      .then((comp) => {
        setPluginComponent(() => comp)
        setLoading(false)
      })
      .catch((e) => {
        const msg = e instanceof Error ? e.message : String(e)
        setLoadError(msg)
        setLoading(false)
        onError?.(msg)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pluginId])

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <span className="ml-2 text-sm text-muted-foreground">Loading plugin…</span>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <AlertTriangle className="h-8 w-8 text-[#e06c75]" />
        <p className="text-sm font-medium text-[#e06c75]">Failed to load plugin</p>
        <pre className="text-xs text-muted-foreground max-w-2xl w-full overflow-auto bg-[#2c313a] p-3 rounded whitespace-pre-wrap border border-[#e06c75]/20">
          {loadError}
        </pre>
        <p className="text-xs text-muted-foreground">
          Plugin: <code className="text-[#abb2bf]">{pluginId}</code>
          {plugin && !plugin.built && " — not yet built (use plugin.build)"}
        </p>
      </div>
    )
  }

  if (!PluginComponent) return null

  return (
    <BundledViewBoundary onError={onError}>
      <PluginComponent
        {...(viewProps as Record<string, unknown>)}
        send={onSend}
      />
    </BundledViewBoundary>
  )
}
