# Harness thinking experience implementation plan

[中文版](2026-10-21-harness-thinking-experience.zh-CN.md)

> Execute inline. The user's request authorizes adapting the frontend to the backend harness; keep the existing interface and four locales.

**Goal:** Show real progress promptly and keep thinking, tool execution and final answers distinct, including stopped and long-context turns.

**Architecture:** Retain typed stream blocks, the existing thinking panel and 60 ms batching. Deliver the first reasoning/text block and control events immediately. Bind stream mutations to a question ID, settle aborts through the request promise and derive UI status from explicit completion evidence. Add a content-free `context` event for actual summary generation via LangGraph's custom stream.

**Tech stack:** React 19, Zustand, Vite, Vitest; Python/deepagents on the backend.

## Constraints

- Base frontend: `2d6891f`, checked against origin/main.
- Four locales: en, zh-CN, zh-TW, ja. No new dependencies or speech feature.
- Waiting feedback is interface status, not a model token. First nonempty reasoning or text is the first visible token.
- Context events contain only an operation ID, phase and status. No generated summaries or patient values.
- Completed summary generation does not assert committed context or perfect recall; `usage.context` remains the evaluation receipt.
- Keep a reader's collapse and scroll choices. Copy only final text, and only acknowledge a successful clipboard write.
- Use synthetic browser fixtures; do not contact production patient services or publish a bundle.

## Task 1: Stream lifecycle

Files: `src/store/Chart/streamTurn.js`, its tests, `index.js`, `data.js`, `src/api/chat.js`.

- [x] Preserve batching while immediately flushing first visible content and control frames.
- [x] Pass AbortSignal to the HTTP request; settle success, error, premature EOF and cancellation.
- [x] Target frames and completion by question ID; stale callbacks and cleanup cannot close a newer turn.
- [x] Test actual ordering, first-token delivery, cancellation and late callbacks.

## Task 2: Thinking and answer presentation

Files: `src/utils/index.js`, `src/pages/Chat/Dialog/Render/ThinkingGroup/`, `Assistant/StatusHeader/`, `Assistant/AssistantCard/`, `Assistant/Card/`, `src/i18n/*.json`.

- [x] Keep thinking groups active across nonvisible usage metadata, with stable identities.
- [x] Render all pending tools as pending, partial results as partial and unresolved stopped tools as unfinished.
- [x] Map `python_exec` to calculation; present summary activity as a distinct step in the work panel.
- [x] Stop automatic inner scrolling when the reader scrolls up; restore following at the bottom.
- [x] Distinguish preparing, thinking, cancellation, failure, waiting-for-user and no-answer outcomes.
- [x] Disable empty copy; await clipboard success and keep all work out of copied final text.
- [x] Verify locale parity, reduced motion, keyboard controls and mobile overflow.

## Task 3: Real summary activity

Backend files: `mirobody/agent/middleware/genotype_summarization.py`, `wire/blocks.py`, `wire/stream.py`, `agent.py`, existing thinking/long-context tests, `docs/answers.md`, `CHANGELOG.md`.

- [x] Emit started/completed/failed lifecycle around actual summary generation, including validation failures.
- [x] Whitelist the lifecycle schema in the renderer and enable custom streaming; ignore unrelated custom data.
- [x] Verify two real automatic summaries carry balanced activity events without summary text.

## Task 4: Verification

- [x] Run frontend tests, lint and production build.
- [x] Run affected backend tests and repository gates, reporting existing full-suite limitations.
- [x] Exercise synthetic live SSE in a browser: thinking before answer, parallel tools, summary activity, cancellation/retry, history, copy, narrow viewport and four locales.
- [x] Record results and remaining real-model/hardware validation limits. The user subsequently requested commits and PRs; deployment remains separate.

## Verification results

- Frontend tests: **460 passed** in 34 files. Lint: zero errors, four existing
  warnings in untouched VisChart/ProviderList/UploadFiles/Login code.
- Production build passed; existing Browserslist age, dependency eval,
  mixed-import and chunk-size warnings remain. No dependency upgrades added.
- Backend: **754 passed, 107 skipped, 12 xfailed** in 21 public/evidence modules.
  Ruff, compileall, six import contracts, bare source imports and diff checks passed.
  Full pytest still has the same five pre-existing gitignored collection failures.
- Browser exercised the real HTTP SSE parser, stores and renderers through a
  local synthetic server: thinking before answer; two pending tools; empty
  successful and partial tool results; actual-shaped context activity;
  cancellation then immediate retry; history without a live clock; answer-only
  clipboard and denied clipboard feedback; Enter/Space expansion; four locales;
  reduced motion; 390 px viewport and compare cards without horizontal overflow.
- A 260 px live thinking viewport retained scrollTop=0 after new reasoning
  arrived while the reader was reviewing older content.
- Production output synchronized to `../mirobody/frontend/`; **74 files** match
  SHA-256 and the destination has no extra assets. No deployment.
- Temporary browser fixture files were removed from the source tree. The
  fixture recipe remains in `/private/tmp/mirobody-web-harness-qa.html`,
  `/private/tmp/mirobody-web-harness-qa.jsx` and
  `/private/tmp/mirobody-harness-sse-qa.py` for this machine's review.
- Stop aborts reception. The server deliberately continues background turns
  after disconnect; true generation cancellation is tracked in the backend
  roadmap, not implied by the UI. Real-model 100-question scores and hardware
  TTFT measurements are still pending.
