import { useSyncExternalStore } from "react";

// Whether the operating system asks for a dark page — the switch tokens.css's
// `prefers-color-scheme` block follows. antd and the charts take colours in JS,
// so they read it here and change in the same frame as the stylesheet.
const QUERY = "(prefers-color-scheme: dark)";

function subscribe(callback) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

export default function usePrefersDark() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
