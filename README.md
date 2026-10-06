# mirobody-web

Source for the Mirobody web client — chat with the health agent, upload
reports, browse the indicators extracted from them. React 19 + Vite.

**Private repo, and the source of the bundle only.** What ships publicly is the
*build output*: it is synced into the [mirobody](https://github.com/thetahealth/mirobody)
backend repo under `frontend/`, which serves that directory as its UI. The
product's open surface is the backend's HTTP + MCP API
([docs.mirobody.ai](https://docs.mirobody.ai/)); this client is one consumer of
it, and everything it does goes through those same documented endpoints.

## Requirements

- Node.js ≥ 20.19 (Vite 7) and npm
- A running backend. Easiest is the Docker deployment in the backend repo —
  `git clone https://github.com/thetahealth/mirobody && ./deploy.sh` — which
  publishes the API on port 18060.

## Develop

```bash
npm install
npm run dev            # http://localhost:5173
```

`npm run dev` calls the API with relative paths and proxies them to
`http://localhost:18060`, so the browser sees one origin and there is no CORS to
configure. Point it elsewhere with `VITE_DEV_PROXY_TARGET` in a `.env.local`.

```bash
npm test               # vitest — the pure helpers (auth, report dates, setup, i18n parity, chart folding)
npm run lint           # eslint
npm run build          # production bundle into dist/
npm run analyze        # same build + a bundle treemap in dist/stats.html
```

## Ship a build

The backend reads its UI directory from disk per request, so a synced build is
live immediately — no restart:

```bash
npm run build
rm -rf ../mirobody/frontend/assets          # rsync --delete alone keeps orphaned hashed chunks
rsync -a --delete dist/ ../mirobody/frontend/
```

Clearing `assets/` first is deliberate: `--delete` will not remove chunks whose
hashed names no longer appear in the new build. Commit the result in the backend
repo — that commit is the only place a frontend change becomes visible to
anyone outside this repo, so say in its message what changed and which commit
here produced it.

Requirements the backend places on that directory: an `index.html` at its root,
hashed filenames under `assets/` for the immutable caching, and client-side
routes that avoid the backend-owned prefixes (`/api`, `/mcp`, `/oauth`,
`/files`, `/personal`, `/auth/session`, `/auth/webauthn`, …). Any other
navigation path falls back to `index.html`, so deep links and refreshes work
without a route whitelist.

## Configure

Committed defaults are in `.env.development` and `.env.production`; every
variable is documented in [`.env.example`](.env.example). Local overrides go in
`.env.local` (gitignored). Nothing is required for a plain build: same-origin
API, no telemetry, no external hosts.

| Variable | Default | What it does |
| --- | --- | --- |
| `VITE_BASE_URL_MCP` | empty (same-origin) | Absolute API base. Only for hosting the bundle away from the backend — which then needs CORS for that origin. |
| `VITE_DEV_PROXY_TARGET` | `http://localhost:18060` | Dev only: where the Vite proxy forwards `/api`, `/auth`, `/files`, `/ws`, … |
| `VITE_DEV_ALLOWED_HOSTS` | empty | Dev only: extra `Host` values the dev server accepts, comma-separated. `localhost` always works. |
| `VITE_ENV` | `production` / `development` | Build label. Substrings matter: `prod` → production Sentry sample rates, `test` → eruda mobile console, `cn` → 简体中文 as the language fallback. |
| `VITE_SENTRY_DSN` | empty | Unset means Sentry is never initialised and no error data leaves the browser. With a DSN it sends `sendDefaultPii: true` and records session replays. |
| `VITE_CDM_URL` | empty | Base URL of the separate developer / API-platform app. Unset, the Settings "Developer Platform" card and the `/developer` route do not exist. |
| `VITE_SHARED_SESSION_DOMAIN` | empty | Parent domain for a session cookie shared with that app. Unset, the session stays in this origin's `localStorage`. **Setting it puts the access token on a cookie readable by every host under that domain** — only do it when a sibling app must read the same session. |

The backend also serves a runtime config document at `GET /mirobody.json`, which
decides at page load which identity methods and capability panels appear — see
[`mirobody.json.example`](mirobody.json.example) for its shape.

## Layout

```
src/
  api/         one module per backend surface (chat, data, indicators, mcp, upload, …)
  service/     axios instance, interceptors, SSE reader
  store/       zustand stores (chat, drive, upload, account, system, …)
  pages/       Chat (/ask) · Drive (/data) · Home · Login · Setup · Share · Developer
  components/  shared UI — modals, form items, file items, header
  router/      routes, protected layout, legacy redirects
  utils/       auth, session manager, websocket manager, i18n, file helpers
  i18n/        en · zh-cn · zh-tw · ja (parity is unit-tested)
  styles/      design tokens (tokens.css) + responsive mixins
docs/          implementation notes (vis-chart rendering)
```

Client-side routes: `/login`, `/mcplogin`, `/setup`, `/share/:shareSessionId`,
`/ask`, `/ask/:sessionId`, `/data`, `/home`, plus `/chat`, `/chat/:sessionId`
and `/drive` as legacy redirects, and `/developer` when `VITE_CDM_URL` is set.

`/setup` is the first-run page: which model reads the deployment's data, a
vendor's (one API key) or open models on the same machine. While
`/mirobody.json` says `"__MODEL_SETUP__": "needed"` every other page leads
there, except the ones opened from a link made for someone (`/mcplogin`,
`/share/…`, `/activate`); Settings › Model returns to it. It works signed out,
because a new deployment has no account yet. Saving takes the setup token
(`SETUP_TOKEN` in the `.env` next to `compose.yaml`; `./deploy.sh` prints a
`/setup?token=…` link, and the page moves the token out of the URL into the
tab's sessionStorage), and once a model is set up, a sign-in as well.

## Conventions

- **Reach the backend only through `src/api/`.** One module per surface; no
  axios calls from components.
- **No hardcoded hosts, and no new third-party runtime requests.** A host
  belongs in an env var with a documented default in `.env.example` — a literal
  in code is how a build ends up shipping a URL it can never reach (that is
  exactly what `config/cdm.js` used to do). Fonts and assets are served from
  the app's own origin; the only outbound exceptions are opt-in and off unless
  configured (Sentry).
- **Four locales or the build fails.** Every user-visible string goes through
  `t()` with an entry in `en`, `zh-cn`, `zh-tw`, `ja`; `src/i18n/parity.test.js`
  enforces it. Note that some keys are reached dynamically — ``t(`report_date_source_${x}`)``,
  `t(item.i18nKey)`, `t(reason)` — so an unreferenced key is not automatically dead.
- **Design tokens over literals.** Colours, spacing, radii and fonts come from
  `src/styles/tokens.css` (and `src/theme.js` for AntD).
- **Tests sit next to what they test** (`foo.js` → `foo.test.js`) and cover pure
  helpers. `vitest` runs in a node environment, so keep DOM-dependent logic out
  of the functions you unit-test.
- **Comments explain why** — the bug a line exists to prevent. Delete dead code
  rather than commenting it out.
- Before pushing: `npm run lint`, `npm test`, `npm run build`. The build is the
  only one of the three that catches a broken import path, a deleted asset or a
  worker that stops resolving.
