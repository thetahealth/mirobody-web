import { useSyncExternalStore } from "react";

// Layout breakpoint — must match the SCSS `phone` mixin and Tailwind `max-md:`
// (≤768px). matchMedia (not UA sniffing) so narrow desktop windows and
// orientation changes are handled live. `isPC` (current-device, UA) stays the
// source of truth for the store's `isPC` — different concern.
const QUERY = "(max-width: 768px)";

function subscribe(callback) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getSnapshot() {
  return window.matchMedia(QUERY).matches;
}

// SSR/first-paint default: desktop (false). No SSR in this app, harmless.
export default function useIsMobile() {
  return useSyncExternalStore(subscribe, getSnapshot, () => false);
}
