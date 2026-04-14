"use client"

/**
 * RuntimeView — Plugin runtime for agent-authored views.
 *
 * Renders agent TSX code natively in the Studio React tree, giving plugins
 * full access to Studio stores (sessions, tasks, agents, tabs).
 *
 * Pipeline: TSX → sucrase (strip types + JSX) → new Function → React component
 *
 * Imports available inside plugin views:
 *   import { useState, useEffect, useRef, useMemo } from "react"
 *   import { useGatewayStore } from "@studio/store"
 *   import { useTabStore } from "@studio/store"
 *   import { useViewProps, send } from "./bridge"  // legacy compat
 *   import { Wrench, Bot, ... } from "lucide-react"
 */

import { useEffect, useRef, useState, Component } from "react"
import * as React from "react"
import * as LucideIcons from "lucide-react"
import { transform } from "sucrase"
import { useGatewayStore } from "@/stores/gateway-store"
import { useTabStore } from "@/stores/tab-store"
import { AlertTriangle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { ViewProps, GatewayMessage } from "@/lib/types"

// ── Error boundary ────────────────────────────────────────

class PluginErrorBoundary extends Component<
  { children: React.ReactNode; onError?: (msg: string) => void },
  { error: string | null }
> {
  state = { error: null as string | null }

  static getDerivedStateFromError(error: Error) {
    return { error: error.message }
  }

  componentDidCatch(error: Error) {
    this.props.onError?.(error.message)
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

// ── Module registry injected into plugin scope ────────────

function buildPluginRequire(
  viewProps: Omit<ViewProps, "send">,
  onSend: ((msg: GatewayMessage) => void) | undefined
) {
  // React module — sucrase converts `import React from "react"` →
  // `const _r = require("react"); const React = _r.default || _r`
  // Use Proxy so .default returns React without mutating the frozen ESM namespace.
  const reactModule = new Proxy({} as Record<string | symbol, unknown>, {
    get(_, prop) {
      if (prop === "default") return React
      return React[prop as keyof typeof React]
    },
  })

  return function require(mod: string): unknown {
    switch (mod) {
      case "react":
        return reactModule

      case "react/jsx-runtime":
        return reactModule

      // Studio store — full Zustand access
      case "@studio/store":
      case "@studio/core":
        return { useGatewayStore, useTabStore, default: { useGatewayStore, useTabStore } }

      // Lucide icons
      case "lucide-react":
        return LucideIcons

      // Legacy bridge compatibility (Sandpack API)
      case "./bridge": {
        const bridge = {
          useViewProps: () => ({ ...viewProps, send: onSend }),
          send: onSend ?? (() => {}),
        }
        return { ...bridge, default: bridge }
      }

      default:
        throw new Error(
          `[Plugin] Cannot import "${mod}"\n` +
          `Available modules: react, @studio/store, @studio/ui, lucide-react, ./bridge`
        )
    }
  }
}

// ── Compile + evaluate plugin code ───────────────────────

function compilePlugin(
  code: string,
  viewProps: Omit<ViewProps, "send">,
  onSend: ((msg: GatewayMessage) => void) | undefined
): React.ComponentType<Record<string, unknown>> {
  // Strip TypeScript types and convert JSX → React.createElement
  const { code: js } = transform(code, {
    transforms: ["typescript", "jsx", "imports"],
    jsxPragma: "React.createElement",
    jsxFragmentPragma: "React.Fragment",
    filePath: "plugin.tsx",
  })

  // CommonJS-style module sandbox
  const exports: Record<string, unknown> = {}
  const require = buildPluginRequire(viewProps, onSend)

  // eslint-disable-next-line no-new-func
  new Function("exports", "require", "React", js)(exports, require, React)

  const DefaultExport = exports.default
  if (typeof DefaultExport !== "function") {
    throw new Error(
      "Plugin must export a default React component.\n" +
      "Example: export default function MyView() { return <div>Hello</div> }"
    )
  }

  return DefaultExport as React.ComponentType<Record<string, unknown>>
}

// ── RuntimeView component ─────────────────────────────────

interface RuntimeViewProps {
  code: string
  viewProps: Omit<ViewProps, "send">
  onSend?: (msg: GatewayMessage) => void
  onError?: (error: string) => void
}

export function RuntimeView({ code, viewProps, onSend, onError }: RuntimeViewProps) {
  const [PluginComponent, setPluginComponent] =
    useState<React.ComponentType<Record<string, unknown>> | null>(null)
  const [compileError, setCompileError] = useState<string | null>(null)
  const lastCodeRef = useRef<string | null>(null)

  useEffect(() => {
    if (lastCodeRef.current === code) return
    lastCodeRef.current = code

    try {
      const comp = compilePlugin(code, viewProps, onSend)
      setPluginComponent(() => comp)
      setCompileError(null)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setCompileError(msg)
      onError?.(msg)
    }
  // viewProps / onSend intentionally excluded — only recompile on code change
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  if (compileError) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-6">
        <AlertTriangle className="h-8 w-8 text-[#e06c75]" />
        <p className="text-sm font-medium text-[#e06c75]">Plugin Compile Error</p>
        <pre className="text-xs text-muted-foreground max-w-2xl w-full overflow-auto bg-[#2c313a] p-3 rounded whitespace-pre-wrap border border-[#e06c75]/20">
          {compileError}
        </pre>
      </div>
    )
  }

  if (!PluginComponent) return null

  return (
    <PluginErrorBoundary onError={onError}>
      <PluginComponent
        {...(viewProps as Record<string, unknown>)}
        send={onSend}
      />
    </PluginErrorBoundary>
  )
}
