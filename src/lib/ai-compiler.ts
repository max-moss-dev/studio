"use client"

import { transform } from "sucrase"
import React from "react"

/**
 * Compiles JSX source code from AI-generated views into a React component.
 * Uses Sucrase for fast browser-side JSX transformation.
 */
export function compileView(jsxSource: string): React.ComponentType | null {
  try {
    // Transform JSX to JS
    const { code } = transform(jsxSource, {
      transforms: ["jsx"],
      jsxRuntime: "classic",
      production: true,
    })

    // Create a function that returns the component
    // Inject available scope: React, hooks, libraries
    const wrappedCode = `
      ${code}

      // Find the default export or first function
      if (typeof TokenChart !== 'undefined') return TokenChart;
      if (typeof View !== 'undefined') return View;
      if (typeof Component !== 'undefined') return Component;
      if (typeof App !== 'undefined') return App;
      return null;
    `

    // Create function with injected scope
    const factory = new Function(
      "React",
      "useState",
      "useEffect",
      "useMemo",
      "useCallback",
      "useRef",
      "useAgentData",
      "BarChart",
      "Bar",
      "XAxis",
      "YAxis",
      "Tooltip",
      "ResponsiveContainer",
      "LineChart",
      "Line",
      "PieChart",
      "Pie",
      "Cell",
      "Area",
      "AreaChart",
      wrappedCode
    )

    // We'll inject the actual libraries lazily when rendering
    const component = factory(
      React,
      React.useState,
      React.useEffect,
      React.useMemo,
      React.useCallback,
      React.useRef,
      null, // useAgentData - injected at render time
      // Recharts placeholders - will be lazy loaded
      () => null,
      () => null,
      () => null,
      () => null,
      () => null,
      () => null,
      () => null,
      () => null,
      () => null,
      () => null,
      () => null,
      () => null
    )

    return component
  } catch (error) {
    console.error("[AI Compiler] Failed to compile view:", error)
    return null
  }
}
