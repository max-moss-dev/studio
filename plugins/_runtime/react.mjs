/**
 * React runtime shim for Studio plugins.
 * esbuild aliases "react" → this file.
 * Reads from globalThis.__studio_react so plugins share the host React instance
 * (required for hooks to work correctly across the React tree).
 */
const r = globalThis.__studio_react

export default r

export const {
  useState,
  useEffect,
  useRef,
  useMemo,
  useCallback,
  useContext,
  useReducer,
  useLayoutEffect,
  useImperativeHandle,
  useDebugValue,
  useId,
  createContext,
  forwardRef,
  memo,
  lazy,
  Suspense,
  StrictMode,
  Component,
  PureComponent,
  Fragment,
  Children,
  createElement,
  cloneElement,
  createRef,
  isValidElement,
} = r
