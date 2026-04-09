"use client"

import { useEffect, useRef, useCallback, useState } from "react"
import {
  SandpackProvider,
  SandpackPreview,
  useSandpack,
} from "@codesandbox/sandpack-react"
import {
  BRIDGE_SOURCE,
  APP_WRAPPER_SOURCE,
  INDEX_SOURCE,
  HTML_TEMPLATE,
} from "@/lib/sandpack-bridge"
import type { ViewMessage } from "@/lib/sandpack-bridge"
import type { ViewProps } from "@/lib/types"
import { AlertTriangle, RotateCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface SandpackViewProps {
  code: string
  dependencies?: Record<string, string>
  viewProps: Omit<ViewProps, "send">
  onSend?: (msg: import("@/lib/types").GatewayMessage) => void
}

/**
 * Bridge component that lives inside SandpackProvider.
 * Listens for "ready" messages from iframe and sends props.
 */
function SandpackBridge({
  viewProps,
  onSend,
}: {
  viewProps: Omit<ViewProps, "send">
  onSend?: (msg: import("@/lib/types").GatewayMessage) => void
}) {
  const { sandpack } = useSandpack()
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const readyRef = useRef(false)
  const propsRef = useRef(viewProps)
  propsRef.current = viewProps

  // Find iframe
  useEffect(() => {
    const interval = setInterval(() => {
      const iframe = document.querySelector(
        ".sp-preview-iframe"
      ) as HTMLIFrameElement | null
      if (iframe && iframe !== iframeRef.current) {
        iframeRef.current = iframe
        readyRef.current = false
      }
    }, 200)
    return () => clearInterval(interval)
  }, [])

  // Listen for messages from iframe
  useEffect(() => {
    function handler(e: MessageEvent) {
      if (!e.data || typeof e.data.type !== "string") return

      const msg = e.data as ViewMessage

      if (msg.type === "ready") {
        readyRef.current = true
        // Send initial props
        const iframe = iframeRef.current
        if (iframe?.contentWindow) {
          // Strip the `send` function — can't serialize functions
          const { agents, events, tasks, messages, models } = propsRef.current
          iframe.contentWindow.postMessage(
            { type: "props", data: { agents, events, tasks, messages, models } },
            "*"
          )
        }
      }

      if (msg.type === "send" && onSend) {
        onSend(msg.payload)
      }

      if (msg.type === "error") {
        console.error("[SandpackView] View error:", msg.message)
      }
    }

    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [onSend])

  // Push prop updates to iframe
  useEffect(() => {
    if (!readyRef.current) return
    const iframe = iframeRef.current
    if (!iframe?.contentWindow) return

    const { agents, events, tasks, messages, models } = viewProps
    iframe.contentWindow.postMessage(
      { type: "props", data: { agents, events, tasks, messages, models } },
      "*"
    )
  }, [viewProps])

  return null
}

/**
 * Renders a user/AI-generated view inside a Sandpack iframe.
 * The view receives ViewProps via postMessage and can send
 * GatewayMessages back to the host.
 */
export function SandpackView({ code, dependencies, viewProps, onSend }: SandpackViewProps) {
  const [error, setError] = useState<string | null>(null)
  const [key, setKey] = useState(0)

  // Build file map for Sandpack
  const files: Record<string, string> = {
    "/bridge.tsx": BRIDGE_SOURCE,
    "/App.tsx": APP_WRAPPER_SOURCE,
    "/index.tsx": INDEX_SOURCE,
    "/view.tsx": code,
    "/public/index.html": HTML_TEMPLATE,
  }

  // Merge base dependencies with view-specific ones
  const deps: Record<string, string> = {
    react: "^18.2.0",
    "react-dom": "^18.2.0",
    ...dependencies,
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 text-muted-foreground bg-[#282c34]">
        <AlertTriangle className="h-8 w-8 text-[#e06c75]" />
        <p className="text-sm font-medium text-[#e06c75]">View Error</p>
        <p className="text-xs max-w-md text-center">{error}</p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null)
            setKey((k) => k + 1)
          }}
          className="gap-1.5"
        >
          <RotateCw className="h-3 w-3" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="h-full w-full" key={key}>
      <SandpackProvider
        template="react-ts"
        files={files}
        customSetup={{
          dependencies: deps,
          entry: "/index.tsx",
        }}
        options={{
          externalResources: [],
          classes: {
            "sp-wrapper": "!h-full",
            "sp-layout": "!h-full !border-0 !rounded-none",
            "sp-preview": "!h-full",
            "sp-preview-container": "!h-full",
          },
        }}
        theme={{
          colors: {
            surface1: "#282c34",
            surface2: "#2c313a",
            surface3: "#3e4451",
            clickable: "#abb2bf",
            base: "#abb2bf",
            disabled: "#5c6370",
            hover: "#61afef",
            accent: "#61afef",
            error: "#e06c75",
            errorSurface: "#3b1d22",
          },
          syntax: {
            plain: "#abb2bf",
            comment: { color: "#5c6370", fontStyle: "italic" },
            keyword: "#c678dd",
            tag: "#e06c75",
            punctuation: "#abb2bf",
            definition: "#61afef",
            property: "#e5c07b",
            static: "#d19a66",
            string: "#98c379",
          },
          font: {
            body: 'system-ui, -apple-system, sans-serif',
            mono: '"JetBrains Mono", "Fira Code", monospace',
            size: "13px",
            lineHeight: "1.6",
          },
        }}
      >
        <SandpackBridge viewProps={viewProps} onSend={onSend} />
        <SandpackPreview
          showOpenInCodeSandbox={false}
          showRefreshButton={false}
          style={{ height: "100%", width: "100%" }}
        />
      </SandpackProvider>
    </div>
  )
}
