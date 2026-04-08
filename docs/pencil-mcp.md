# Pencil MCP Cheatsheet

Design file: `design/studio.pen`

## Start

```
1. get_editor_state({ include_schema: true })  — see what's open + load schema
2. open_document("path/to/file.pen")           — open existing file
3. open_document("new")                         — blank canvas
```

## Read

```
batch_get({ nodeIds: ["id1","id2"], readDepth: 3 })  — inspect node trees
snapshot_layout({ filePath: "...", parentId: "x", maxDepth: 2 })  — check positions/sizes
get_screenshot({ nodeId: "x" })  — visual verification
get_variables()  — design tokens
get_guidelines()  — list available guides
get_guidelines("guide", "Web App")  — load specific guide
```

## Write

`batch_design` — max 25 ops per call:

```
foo=I("parent", { type:"frame", ... })     — Insert
bar=C("nodeId", "parent", { ... })         — Copy
U("nodeId", { fill:"#282c34" })            — Update
R("nodeId", { type:"text", ... })          — Replace
D("nodeId")                                — Delete
M("nodeId", "newParent", index)            — Move
G("nodeId", "ai", "prompt for image")      — Generate image
```

## Key Rules

- Always set `placeholder: true` on frames you're working on, remove when done
- Text needs `fill` to be visible
- `textGrowth` must be set before `width`/`height` on text
- `x`/`y` ignored inside flexbox — use layout props instead
- `fill_container` only works inside flexbox parent
- Use `get_screenshot` after changes to verify
- Max 25 operations per `batch_design` call

## Design Tokens (OneDark)

| Token | Hex |
|-------|-----|
| Background | `#282c34` |
| Header | `#1e2127` |
| Surface/card | `#2c313a` |
| Border | `#3e4451` |
| Tab border | `#2e3239` |
| Text primary | `#d7dae0` |
| Text secondary | `#abb2bf` |
| Text muted | `#5c6370` |
| Online/green | `#98c379` |
| Blue | `#61afef` |
| Purple | `#c678dd` |
| Yellow | `#e5c07b` |
| Red | `#e06c75` |
| Orange | `#d19a66` |
