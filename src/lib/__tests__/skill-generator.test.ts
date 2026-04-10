import { describe, it, expect } from "vitest"
import { generateSkill } from "../skill-generator"

describe("generateSkill", () => {
  it("generates skill with title", () => {
    const skill = generateSkill({
      title: "My Dashboard",
      code: `import { useViewProps } from './bridge'\nexport default function MyView() { const { agents } = useViewProps(); return <div /> }`,
    })
    expect(skill).toContain("# My Dashboard")
  })

  it("detects used ViewProps fields", () => {
    const skill = generateSkill({
      title: "Test",
      code: `
        const { agents, tasks, events, messages, models } = useViewProps()
      `,
    })
    expect(skill).toContain("agents")
    expect(skill).toContain("tasks")
    expect(skill).toContain("events")
    expect(skill).toContain("messages")
    expect(skill).toContain("models")
  })

  it("detects only used props, not all", () => {
    const skill = generateSkill({
      title: "Test",
      code: `const { agents } = useViewProps()`,
    })
    expect(skill).toContain("agents")
    // The "Data used" section should not list messages or models
    const dataSection = skill.split("## Data used")[1]?.split("##")[0] ?? ""
    expect(dataSection).not.toContain("messages")
    expect(dataSection).not.toContain("models")
  })

  it("detects agent sub-fields", () => {
    const skill = generateSkill({
      title: "Test",
      code: `agents.map(a => a.name + a.tokensToday + a.status)`,
    })
    expect(skill).toContain("`name`")
    expect(skill).toContain("`tokensToday`")
    expect(skill).toContain("`status`")
  })

  it("detects task sub-fields", () => {
    const skill = generateSkill({
      title: "Test",
      code: `tasks.filter(t => t.status === "done").map(t => t.title)`,
    })
    expect(skill).toContain("`status`")
    expect(skill).toContain("`title`")
  })

  it("detects send() usage", () => {
    const skill = generateSkill({
      title: "Test",
      code: `send({ type: "agent.message", agentId: "x", content: "hi" })`,
    })
    expect(skill).toContain("send()")
  })

  it("does not mention send() when not used", () => {
    const skill = generateSkill({
      title: "Test",
      code: `const { agents } = useViewProps(); return <div />`,
    })
    expect(skill).not.toContain("send()")
  })

  it("detects React hooks", () => {
    const skill = generateSkill({
      title: "Test",
      code: `
        const [x, setX] = useState(0)
        useEffect(() => {}, [])
        const memo = useMemo(() => x, [x])
      `,
    })
    expect(skill).toContain("useState")
    expect(skill).toContain("useEffect")
    expect(skill).toContain("useMemo")
  })

  it("detects npm imports", () => {
    const skill = generateSkill({
      title: "Test",
      code: `
        import { BarChart, Bar } from "recharts"
        import { motion } from "framer-motion"
      `,
    })
    expect(skill).toContain("recharts")
    expect(skill).toContain("framer-motion")
  })

  it("skips react and bridge imports", () => {
    const skill = generateSkill({
      title: "Test",
      code: `
        import { useState } from "react"
        import { useViewProps } from "./bridge"
      `,
    })
    // Should not list react or ./bridge as dependencies
    const lines = skill.split("\n")
    const importSection = lines.filter((l) => l.startsWith("- react") || l.startsWith("- ./bridge"))
    expect(importSection).toHaveLength(0)
  })

  it("includes dependencies when provided", () => {
    const skill = generateSkill({
      title: "Test",
      code: `import { BarChart } from "recharts"`,
      dependencies: { recharts: "^2.8.0", "d3-force": "^3.0.0" },
    })
    expect(skill).toContain("## Dependencies")
    expect(skill).toContain("recharts ^2.8.0")
    expect(skill).toContain("d3-force ^3.0.0")
  })

  it("detects JSX components", () => {
    const skill = generateSkill({
      title: "Test",
      code: `return <BarChart><Bar /><XAxis /></BarChart>`,
    })
    expect(skill).toContain("BarChart")
    expect(skill).toContain("Bar")
    expect(skill).toContain("XAxis")
  })

  it("always includes how-to-modify section", () => {
    const skill = generateSkill({
      title: "Test",
      code: `export default function X() { return <div /> }`,
    })
    expect(skill).toContain("## How to modify")
    expect(skill).toContain("useViewProps()")
    expect(skill).toContain("OneDark")
  })
})
