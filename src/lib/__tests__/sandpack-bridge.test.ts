import { describe, it, expect } from "vitest"
import {
  BRIDGE_SOURCE,
  APP_WRAPPER_SOURCE,
  INDEX_SOURCE,
  HTML_TEMPLATE,
} from "../sandpack-bridge"

describe("sandpack-bridge exports", () => {
  it("exports BRIDGE_SOURCE as non-empty string", () => {
    expect(typeof BRIDGE_SOURCE).toBe("string")
    expect(BRIDGE_SOURCE.length).toBeGreaterThan(100)
  })

  it("exports APP_WRAPPER_SOURCE as non-empty string", () => {
    expect(typeof APP_WRAPPER_SOURCE).toBe("string")
    expect(APP_WRAPPER_SOURCE.length).toBeGreaterThan(50)
  })

  it("exports INDEX_SOURCE as non-empty string", () => {
    expect(typeof INDEX_SOURCE).toBe("string")
    expect(INDEX_SOURCE.length).toBeGreaterThan(50)
  })

  it("exports HTML_TEMPLATE as non-empty string", () => {
    expect(typeof HTML_TEMPLATE).toBe("string")
    expect(HTML_TEMPLATE.length).toBeGreaterThan(50)
  })
})

describe("BRIDGE_SOURCE content", () => {
  it("exports useViewProps hook", () => {
    expect(BRIDGE_SOURCE).toContain("export function useViewProps()")
  })

  it("exports send function", () => {
    expect(BRIDGE_SOURCE).toContain("export function send(")
  })

  it("exports ViewBridge component", () => {
    expect(BRIDGE_SOURCE).toContain("export function ViewBridge(")
  })

  it("uses postMessage for communication", () => {
    expect(BRIDGE_SOURCE).toContain("postMessage")
  })

  it("listens for props messages", () => {
    expect(BRIDGE_SOURCE).toContain('"props"')
  })

  it("listens for props-update messages", () => {
    expect(BRIDGE_SOURCE).toContain('"props-update"')
  })

  it("sends ready message on mount", () => {
    expect(BRIDGE_SOURCE).toContain('"ready"')
  })

  it("uses React context for ViewProps", () => {
    expect(BRIDGE_SOURCE).toContain("createContext")
    expect(BRIDGE_SOURCE).toContain("useContext")
  })
})

describe("APP_WRAPPER_SOURCE content", () => {
  it("imports ViewBridge from bridge", () => {
    expect(APP_WRAPPER_SOURCE).toContain('from "./bridge"')
    expect(APP_WRAPPER_SOURCE).toContain("ViewBridge")
  })

  it("imports View from view", () => {
    expect(APP_WRAPPER_SOURCE).toContain('from "./view"')
  })

  it("wraps View in ViewBridge", () => {
    expect(APP_WRAPPER_SOURCE).toContain("<ViewBridge>")
    expect(APP_WRAPPER_SOURCE).toContain("<View />")
    expect(APP_WRAPPER_SOURCE).toContain("</ViewBridge>")
  })
})

describe("INDEX_SOURCE content", () => {
  it("imports createRoot from react-dom", () => {
    expect(INDEX_SOURCE).toContain("createRoot")
    expect(INDEX_SOURCE).toContain("react-dom")
  })

  it("renders App component", () => {
    expect(INDEX_SOURCE).toContain("<App />")
  })

  it("mounts to #root element", () => {
    expect(INDEX_SOURCE).toContain('getElementById("root")')
  })
})

describe("HTML_TEMPLATE content", () => {
  it("has root div", () => {
    expect(HTML_TEMPLATE).toContain('id="root"')
  })

  it("uses OneDark background color", () => {
    expect(HTML_TEMPLATE).toContain("#282c34")
  })

  it("is valid HTML document", () => {
    expect(HTML_TEMPLATE).toContain("<!DOCTYPE html>")
    expect(HTML_TEMPLATE).toContain("</html>")
  })
})
