import { describe, it, expect, beforeEach } from "vitest"
import { useViewStore } from "../view-store"

// Reset store state between tests
beforeEach(() => {
  const store = useViewStore.getState()
  // Remove all non-built-in views
  const aiViews = store.views.filter((v) => v.type !== "built-in")
  for (const v of aiViews) {
    store.removeView(v.id)
  }
  store.clearInstallError()
})

describe("useViewStore", () => {
  describe("built-in views", () => {
    it("has built-in views on initialization", () => {
      const views = useViewStore.getState().getBuiltInViews()
      expect(views.length).toBeGreaterThan(0)
    })

    it("includes agent-manager, kanban, chats, office", () => {
      const ids = useViewStore.getState().getBuiltInViews().map((v) => v.id)
      expect(ids).toContain("agent-manager")
      expect(ids).toContain("kanban")
      expect(ids).toContain("chats")
      expect(ids).toContain("office")
    })

    it("cannot remove built-in views", () => {
      useViewStore.getState().removeView("agent-manager")
      const view = useViewStore.getState().getView("agent-manager")
      expect(view).toBeDefined()
    })
  })

  describe("registerView", () => {
    it("registers a new AI-generated view", () => {
      useViewStore.getState().registerView({
        id: "test-view",
        title: "Test View",
        icon: "sparkles",
        type: "ai-generated",
        code: "export default function Test() { return <div>test</div> }",
      })
      const view = useViewStore.getState().getView("test-view")
      expect(view).toBeDefined()
      expect(view?.title).toBe("Test View")
    })

    it("auto-generates skill when code is present but no skill", () => {
      useViewStore.getState().registerView({
        id: "skill-test",
        title: "Skill Test",
        icon: "sparkles",
        type: "ai-generated",
        code: `import { useViewProps } from './bridge'\nexport default function V() { const { agents } = useViewProps(); return <div>{agents.length}</div> }`,
      })
      const view = useViewStore.getState().getView("skill-test")
      expect(view?.skill).toBeDefined()
      expect(view?.skill).toContain("# Skill Test")
      expect(view?.skill).toContain("agents")
    })

    it("does not overwrite existing skill", () => {
      useViewStore.getState().registerView({
        id: "skill-keep",
        title: "Keep Skill",
        icon: "sparkles",
        type: "ai-generated",
        code: "export default function V() { return <div /> }",
        skill: "# Custom Skill\nMy custom skill",
      })
      const view = useViewStore.getState().getView("skill-keep")
      expect(view?.skill).toBe("# Custom Skill\nMy custom skill")
    })

    it("replaces existing view with same id", () => {
      useViewStore.getState().registerView({
        id: "replace-test",
        title: "Version 1",
        icon: "sparkles",
        type: "ai-generated",
        code: "v1",
      })
      useViewStore.getState().registerView({
        id: "replace-test",
        title: "Version 2",
        icon: "sparkles",
        type: "ai-generated",
        code: "v2",
      })
      const views = useViewStore.getState().views.filter((v) => v.id === "replace-test")
      expect(views).toHaveLength(1)
      expect(views[0].title).toBe("Version 2")
    })
  })

  describe("removeView", () => {
    it("removes an AI-generated view", () => {
      useViewStore.getState().registerView({
        id: "to-remove",
        title: "Remove Me",
        icon: "sparkles",
        type: "ai-generated",
      })
      useViewStore.getState().removeView("to-remove")
      expect(useViewStore.getState().getView("to-remove")).toBeUndefined()
    })
  })

  describe("getAiViews / getPlugins", () => {
    it("returns only AI views", () => {
      useViewStore.getState().registerView({
        id: "ai-1",
        title: "AI 1",
        icon: "sparkles",
        type: "ai-generated",
      })
      const aiViews = useViewStore.getState().getAiViews()
      expect(aiViews.every((v) => v.type === "ai-generated")).toBe(true)
    })
  })

  describe("importPackage / exportPackage", () => {
    it("exports a view as JSON", () => {
      useViewStore.getState().registerView({
        id: "export-test",
        title: "Export Test",
        icon: "bar-chart",
        type: "ai-generated",
        code: "export default function X() { return <div /> }",
        dependencies: { recharts: "^2.8.0" },
      })
      const json = useViewStore.getState().exportPackage("export-test")
      expect(json).toBeDefined()

      const parsed = JSON.parse(json!)
      expect(parsed.id).toBe("export-test")
      expect(parsed.title).toBe("Export Test")
      expect(parsed.code).toContain("export default")
      expect(parsed.dependencies.recharts).toBe("^2.8.0")
    })

    it("returns null for views without code", () => {
      const json = useViewStore.getState().exportPackage("agent-manager")
      expect(json).toBeNull()
    })

    it("imports a valid JSON package", () => {
      const pkg = JSON.stringify({
        id: "imported-view",
        title: "Imported View",
        icon: "sparkles",
        code: "export default function Imported() { return <div>imported</div> }",
      })
      const view = useViewStore.getState().importPackage(pkg)
      expect(view.id).toBe("imported-view")
      expect(view.title).toBe("Imported View")
      expect(useViewStore.getState().getView("imported-view")).toBeDefined()
    })

    it("throws on invalid JSON", () => {
      expect(() => useViewStore.getState().importPackage("not json")).toThrow()
    })

    it("throws on missing required fields", () => {
      expect(() =>
        useViewStore.getState().importPackage(JSON.stringify({ id: "x" }))
      ).toThrow("title")
    })

    it("throws on missing code", () => {
      expect(() =>
        useViewStore.getState().importPackage(
          JSON.stringify({ id: "x", title: "X" })
        )
      ).toThrow("code")
    })

    it("roundtrips export → import", () => {
      useViewStore.getState().registerView({
        id: "roundtrip",
        title: "Roundtrip Test",
        icon: "zap",
        type: "ai-generated",
        code: "export default function R() { return <div>round</div> }",
        dependencies: { recharts: "^2.8.0" },
      })

      const json = useViewStore.getState().exportPackage("roundtrip")!
      useViewStore.getState().removeView("roundtrip")
      expect(useViewStore.getState().getView("roundtrip")).toBeUndefined()

      const imported = useViewStore.getState().importPackage(json)
      expect(imported.id).toBe("roundtrip")
      expect(imported.title).toBe("Roundtrip Test")
      expect(imported.dependencies?.recharts).toBe("^2.8.0")
    })
  })
})
