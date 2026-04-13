"use client"

import { useState, useCallback, useMemo, memo, useRef, useEffect } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import type { Components } from "react-markdown"

interface MarkdownRendererProps {
  content: string
  onContentChange?: (newContent: string) => void
  className?: string
  /** When true, renders plain text instead of parsing markdown (for streaming) */
  streaming?: boolean
}

/**
 * Interactive markdown renderer with:
 * - GFM (GitHub Flavored Markdown) support
 * - Interactive checkboxes that toggle in source
 * - Styled tables, code blocks, links
 * - Streaming mode: renders plain text to avoid expensive re-parses
 */
export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  onContentChange,
  className,
  streaming,
}: MarkdownRendererProps) {
  // Local state only used for standalone checkbox toggling (no onContentChange)
  const [localEdits, setLocalEdits] = useState<string | null>(null)
  const prevContentRef = useRef(content)

  // Reset local edits when content prop changes (e.g. during streaming)
  useEffect(() => {
    if (content !== prevContentRef.current) {
      prevContentRef.current = content
      setLocalEdits(null)
    }
  }, [content])

  const displayContent = onContentChange ? content : (localEdits ?? content)

  const handleCheckboxToggle = useCallback(
    (lineIndex: number) => {
      const lines = displayContent.split("\n")
      const line = lines[lineIndex]
      if (!line) return

      if (line.match(/- \[ \]/)) {
        lines[lineIndex] = line.replace("- [ ]", "- [x]")
      } else if (line.match(/- \[x\]/i)) {
        lines[lineIndex] = line.replace(/- \[x\]/i, "- [ ]")
      }

      const newContent = lines.join("\n")
      if (onContentChange) {
        onContentChange(newContent)
      } else {
        setLocalEdits(newContent)
      }
    },
    [displayContent, onContentChange]
  )

  // Memoize components to avoid ReactMarkdown full re-renders
  const components: Components = useMemo(() => {
    // Track which checkbox we're on to map to source lines
    let checkboxIndex = -1
    const checkboxLineMap: number[] = []
    const lines = displayContent.split("\n")
    lines.forEach((line, i) => {
      if (line.match(/- \[[ x]\]/i)) {
        checkboxLineMap.push(i)
      }
    })

    return {
      input: (props) => {
        if (props.type === "checkbox") {
          checkboxIndex++
          const idx = checkboxIndex
          const lineIdx = checkboxLineMap[idx]
          return (
            <input
              type="checkbox"
              checked={props.checked}
              onChange={() => {
                if (lineIdx !== undefined) handleCheckboxToggle(lineIdx)
              }}
              className="mr-2 cursor-pointer accent-[#98c379] h-4 w-4 align-middle"
            />
          )
        }
        return <input {...props} />
      },

      code: ({ className: codeClass, children, ...rest }) => {
        const isInline = !codeClass
        if (isInline) {
          return (
            <code
              className="rounded bg-[#2c313a] px-1.5 py-0.5 text-[13px] font-mono text-[#e5c07b]"
              {...rest}
            >
              {children}
            </code>
          )
        }
        return (
          <code
            className={`block rounded-md bg-[#2c313a] p-3 text-[13px] font-mono overflow-x-auto ${codeClass ?? ""}`}
            {...rest}
          >
            {children}
          </code>
        )
      },

      pre: ({ children }) => (
        <pre className="rounded-md bg-[#2c313a] border border-[#3e4451] overflow-x-auto my-2">
          {children}
        </pre>
      ),

      a: ({ href, children }) => (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[#61afef] underline hover:text-[#61afef]/80"
        >
          {children}
        </a>
      ),

      table: ({ children }) => (
        <div className="overflow-x-auto my-2">
          <table className="w-full text-sm border-collapse">{children}</table>
        </div>
      ),
      th: ({ children }) => (
        <th className="border border-[#3e4451] bg-[#2c313a] px-3 py-1.5 text-left font-medium">
          {children}
        </th>
      ),
      td: ({ children }) => (
        <td className="border border-[#3e4451] px-3 py-1.5">{children}</td>
      ),

      h1: ({ children }) => (
        <h1 className="text-xl font-bold mt-4 mb-2 text-[#d7dae0]">{children}</h1>
      ),
      h2: ({ children }) => (
        <h2 className="text-lg font-semibold mt-3 mb-1.5 text-[#d7dae0]">{children}</h2>
      ),
      h3: ({ children }) => (
        <h3 className="text-base font-semibold mt-2 mb-1 text-[#d7dae0]">{children}</h3>
      ),

      ul: ({ children }) => (
        <ul className="list-disc pl-5 my-1 space-y-0.5">{children}</ul>
      ),
      ol: ({ children }) => (
        <ol className="list-decimal pl-5 my-1 space-y-0.5">{children}</ol>
      ),
      li: ({ children, className: liClass }) => {
        const isTask = liClass?.includes("task-list-item")
        return (
          <li className={isTask ? "list-none -ml-5 flex items-start gap-0" : ""}>
            {children}
          </li>
        )
      },

      blockquote: ({ children }) => (
        <blockquote className="border-l-2 border-[#61afef] pl-3 my-2 text-[#abb2bf] italic">
          {children}
        </blockquote>
      ),

      p: ({ children }) => <p className="my-1">{children}</p>,

      hr: () => <hr className="border-[#3e4451] my-3" />,

      img: ({ src, alt }) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt ?? ""}
          className="max-w-full rounded-md my-2"
        />
      ),
    }
  }, [displayContent, handleCheckboxToggle])

  // During streaming, render plain text to avoid expensive markdown re-parses
  if (streaming) {
    return (
      <div className={`prose prose-invert max-w-none text-sm text-[#abb2bf] ${className ?? ""}`}>
        <p className="my-1 whitespace-pre-wrap">{displayContent}</p>
      </div>
    )
  }

  return (
    <div className={`prose prose-invert max-w-none text-sm text-[#abb2bf] ${className ?? ""}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
      >
        {displayContent}
      </ReactMarkdown>
    </div>
  )
})
