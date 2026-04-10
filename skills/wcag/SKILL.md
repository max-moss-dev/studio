# WCAG Accessibility Skill

This skill provides guidance on WCAG (Web Content Accessibility Guidelines) color contrast requirements for UI/UX design and code. Apply these rules whenever creating or reviewing designs, CSS, or UI components.

## Color Contrast Requirements

### WCAG 2.1 AA (Minimum — required)
- **Normal text** (< 18pt / < 14pt bold): contrast ratio ≥ **4.5:1**
- **Large text** (≥ 18pt / ≥ 14pt bold): contrast ratio ≥ **3:1**
- **UI components and graphical objects**: contrast ratio ≥ **3:1** against adjacent colors

### WCAG 2.1 AAA (Enhanced — recommended)
- **Normal text**: contrast ratio ≥ **7:1**
- **Large text**: contrast ratio ≥ **4.5:1**

## Common Failing Combinations

These combinations commonly fail WCAG AA and must be avoided:

| Foreground | Background | Ratio (approx) | Status |
|---|---|---|---|
| White `#ffffff` | Light blue `#61afef` | ~2.8:1 | ❌ Fails AA |
| White `#ffffff` | Yellow `#e5c07b` | ~1.9:1 | ❌ Fails AA |
| White `#ffffff` | Green `#98c379` | ~2.3:1 | ❌ Fails AA |
| Black `#000000` | Dark grey `#282c34` | ~16:1 | ✅ Passes AAA |
| White `#ffffff` | Dark grey `#282c34` | ~12:1 | ✅ Passes AAA |

## Studio App — OneDark Theme Guidance

The Studio app uses an OneDark color scheme. When placing text on colored backgrounds:

- **On `#61afef` (orchestrator/blue)**: Use dark text `#1e2127` or `#282c34`, not white
- **On `#98c379` (online/green)**: Use dark text, not white
- **On `#e5c07b` (busy/yellow)**: Use dark text, not white
- **On `#e06c75` (error/red)**: White text may work — verify with contrast checker
- **On `#282c34` (background)**: White or light text is safe
- **On `#1e2127` (header)**: White or light text is safe
- **On `#2c313a` (surface)**: White or light text is safe

## How to Check Contrast

Use the relative luminance formula or these tools:
- [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/)
- Chrome DevTools → Accessibility → Color Contrast
- Figma / Pencil: check the accessibility annotation panel

## Rule for Design Agents

**Before finalizing any design with text on a colored background:**
1. Identify the foreground and background hex values
2. Calculate or look up the contrast ratio
3. Ensure ratio meets at least 4.5:1 for normal text (AA)
4. If it fails, switch to a dark text color or darken the background

**Do not ship UI with white text on light-colored backgrounds** — this is the most common WCAG failure in the Studio codebase.
