"use client"

import { transform } from "sucrase"
import React from "react"

/**
 * Compiles JSX/TSX source code into a React component at runtime.
 * Supports:
 *   - `export default function Foo() { ... }`
 *   - `export default Foo`
 *   - Named function/const `View`, `Component`, `App`, or the first function found
 */
export function compileView(jsxSource: string): React.ComponentType<Record<string, unknown>> | null {
  try {
    // Transform JSX + TypeScript to plain JS
    const { code } = transform(jsxSource, {
      transforms: ["jsx", "typescript"],
      jsxRuntime: "classic",
      production: true,
    })

    // Wrap in a module-style factory:
    // - We provide a `exports` object to capture `export default`
    // - Sucrase turns `export default X` into `exports.default = X`
    const wrappedCode = `
      var exports = {};
      ${code}

      // 1. Check for default export (Sucrase output)
      if (exports.default) return exports.default;

      // 2. Check common component names
      if (typeof View !== 'undefined') return View;
      if (typeof Component !== 'undefined') return Component;
      if (typeof App !== 'undefined') return App;
      if (typeof Plugin !== 'undefined') return Plugin;

      // 3. Scan exports for any function/component
      var keys = Object.keys(exports);
      for (var i = 0; i < keys.length; i++) {
        var val = exports[keys[i]];
        if (typeof val === 'function') return val;
      }

      return null;
    `

    const factory = new Function(
      "React",
      "useState",
      "useEffect",
      "useMemo",
      "useCallback",
      "useRef",
      wrappedCode
    )

    const component = factory(
      React,
      React.useState,
      React.useEffect,
      React.useMemo,
      React.useCallback,
      React.useRef,
    )

    return component
  } catch (error) {
    console.error("[AI Compiler] Failed to compile view:", error)
    return null
  }
}
