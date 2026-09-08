// Optional link-out to a separate developer / API-platform deployment.
//
// Some deployments run a second app next to this one (a marketing landing site
// with a developer console at /developer) and want two entry points into it:
// the Settings "Developer Platform" card and the /developer route. A plain
// self-hosted install has no such app, so the URL is configuration and the
// entry points only exist once it is set — see IS_CDM_ENABLED, which gates
// `isShowDeveloper` in store/system.js.
//
//   VITE_CDM_URL=https://developer.example.com
//
// This used to fall back to a hardcoded vendor host when unset, which put that
// host into every build — including builds that could never reach it.
export const CDM_URL = (import.meta.env.VITE_CDM_URL || "").replace(/\/+$/, "");

export const IS_CDM_ENABLED = CDM_URL !== "";
