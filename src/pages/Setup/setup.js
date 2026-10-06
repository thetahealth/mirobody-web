// Pure helpers for the first-run page. Framework-free so they unit-test under
// the repo's node-env vitest setup; the browser objects they touch are
// parameters, defaulting to the real ones.

import { SETUP_SKIPPED, SETUP_TOKEN } from "../../enum/storage.js";

/**
 * The setup token, taken out of the address bar.
 *
 * `./deploy.sh` prints `/setup?token=…`. The token decides where health data
 * goes, so it moves into this tab's sessionStorage and leaves the URL at once:
 * an address stays in history, in a bookmark, in a screenshot of the page. The
 * rest of the query and the router's history state are kept.
 *
 * @returns {string} the token from the link, else the one this tab kept, else ""
 */
export function captureSetupToken(win = window) {
  const params = new URLSearchParams(win.location.search);
  const fromLink = params.get("token");
  if (fromLink) {
    rememberSetupToken(fromLink, win);
    params.delete("token");
    const rest = params.toString();
    win.history.replaceState(
      win.history.state,
      "",
      win.location.pathname + (rest ? `?${rest}` : "") + win.location.hash,
    );
    return fromLink;
  }
  try {
    return win.sessionStorage.getItem(SETUP_TOKEN) || "";
  } catch {
    return "";
  }
}

/** Keep the token for this tab, or forget it (""). Storage can be off; then the page asks again. */
export function rememberSetupToken(token, win = window) {
  try {
    if (token) win.sessionStorage.setItem(SETUP_TOKEN, token);
    else win.sessionStorage.removeItem(SETUP_TOKEN);
  } catch {
    // private mode: the token lives in the page's state only
  }
}

/** "Not now" on the first-run page, for the rest of this tab. */
export function skipSetup(win = window) {
  try {
    win.sessionStorage.setItem(SETUP_SKIPPED, "1");
  } catch {
    // without storage the page comes back on the next navigation
  }
}

export function setupSkipped(win = window) {
  try {
    return win.sessionStorage.getItem(SETUP_SKIPPED) === "1";
  } catch {
    return false;
  }
}

// Pages that are not sent to /setup while no model is set up: the page
// itself, and the ones someone opens from a link made for them (an agent's MCP
// sign-in, a shared conversation, an account activation), which work without
// a model and would lose what they came for.
export const SETUP_EXEMPT_PATHS = ["/setup", "/mcplogin", "/share/", "/activate"];

/**
 * Whether the app sends this page to /setup. While no model is set up, chat,
 * summaries and report reading all fail, and the first thing a new deployment
 * needs is the choice, so every other page leads there until it is made or
 * put off for the tab.
 */
export const sendsToSetup = ({ modelSetup, pathname, skipped }) =>
  modelSetup === "needed" &&
  !skipped &&
  !SETUP_EXEMPT_PATHS.some((path) => pathname.startsWith(path));

/** The local-models tab a visitor most likely needs: a Mac runs llama.cpp itself, anything else an NVIDIA container. */
export function guessPlatform(nav = navigator) {
  const platform = nav?.userAgentData?.platform || nav?.platform || "";
  return /mac/i.test(platform) ? "mac" : "gpu";
}

/**
 * What starts the model server, run in the mirobody folder (docs/local-models.md
 * in the backend repo). "other" has no one command; the guide has the steps.
 *
 * @param {"mac" | "gpu" | "cpu" | "other"} platform
 * @param {string} preset - the llama.cpp models preset the server ships
 */
export function startCommand(platform, preset) {
  switch (platform) {
    case "mac":
      return `brew install llama.cpp\nllama-server --models-preset ${preset} --port 8080`;
    case "gpu":
      return "docker compose --profile local up -d";
    case "cpu":
      return "docker compose --profile local-cpu up -d";
    default:
      return "";
  }
}

/**
 * The local models, once each: `agent` and `utils` usually name the same one,
 * and a person sees two models, not three roles.
 *
 * @param {{models?: object, status?: object}} local - `GET /api/setup`'s `local`
 * @returns {{model: string, status: string}[]}
 */
export function localModels(local) {
  const models = local?.models || {};
  const status = local?.status || {};
  const list = [];
  for (const role of ["agent", "utils", "ocr"]) {
    const model = models[role];
    if (!model || list.some((m) => m.model === model)) continue;
    list.push({ model, status: status[role] || "missing" });
  }
  return list;
}

// llama.cpp's router says "loaded"; any other OpenAI-compatible server only
// lists what it serves, which the API reports as "ready".
export const isReady = (status) => status === "loaded" || status === "ready";

/**
 * Whether saving needs a sign-in first. While no model is set up the setup
 * token is enough: the page is reached before any account exists. Once one
 * is, changing it also takes a signed-in session, so a signed-out visitor is
 * told before typing a key rather than after.
 */
export const needsSignIn = ({ needed, signedIn }) => needed === false && !signedIn;

/*
 * Model names. A vendor renames its models faster than the config ships, so
 * each entry's model is the deployment's to change: `GET /api/setup` gives
 * every model it would run as `{model, default, env, in_env_file}` (in use,
 * as config.llm.yaml writes it, the variable that holds a change, and whether
 * .env sets that variable). `POST` takes a changed name beside the key or the
 * local server, keeps what is in use when given nothing, and stores nothing
 * for the configured name, so a later config update still reaches it.
 */

/** What a model field starts with: the model in use, else the configured one. */
export const modelDraft = (field) => field?.model || field?.default || "";

/**
 * Whether the page may change this model: its entry names a variable for it,
 * and .env does not already set that variable (.env always wins, so a change
 * here would be refused with a 409).
 */
export const modelEditable = (field) => Boolean(field?.env) && !field?.in_env_file;

/** A typed name the server would refuse: model ids have no spaces. */
export const badModelName = (typed) => {
  const value = String(typed || "").trim();
  return value.length > 200 || /\s/.test(value);
};

/**
 * The name to send for one model, or "" to send none: only an editable field
 * the person changed. An emptied field keeps the model in use, as the server
 * reads an empty name; the default, typed back over a changed name, is sent
 * and stored as nothing.
 */
export const modelToSend = (field, typed) => {
  const value = String(typed || "").trim();
  if (!modelEditable(field) || !value || value === field.model) return "";
  return value;
};

/** Whether to offer "use the default": the field holds something else. */
export const offersDefault = (field, typed) =>
  modelEditable(field) && Boolean(field.default) && String(typed || "").trim() !== field.default;

/** The model a save would leave running for a field, for the "chat uses …" line. */
export const modelInEffect = (field, typed) =>
  (modelEditable(field) && String(typed || "").trim()) || field?.model || field?.default || "";

/** `POST /api/setup` for a key, with a model name only where one changed. */
export function keyChoice({ provider, apiKey, chatField, chatTyped, utilsField, utilsTyped }) {
  const body = { mode: "key", name: provider, value: String(apiKey || "").trim() };
  const model = modelToSend(chatField, chatTyped);
  const utilsModel = modelToSend(utilsField, utilsTyped);
  if (model) body.model = model;
  if (utilsModel) body.utils_model = utilsModel;
  return body;
}

/**
 * `POST /api/setup` for the models on this machine. `utils` shares the agent's
 * variable (LOCAL_MODEL), so only the agent and the OCR model are chosen.
 */
export function localChoice({ baseUrl, agentField, agentChosen, ocrField, ocrChosen }) {
  const body = { mode: "local", base_url: String(baseUrl || "").trim() };
  const model = modelToSend(agentField, agentChosen);
  const ocrModel = modelToSend(ocrField, ocrChosen);
  if (model) body.model = model;
  if (ocrModel) body.ocr_model = ocrModel;
  return body;
}

/**
 * The models a found server offers for one role: everything it serves, and
 * the model in use first when it does not serve it, so the choice opens on
 * what runs now and can say that it is missing there.
 *
 * @param {{id: string}[]} served - `GET /api/setup/local`'s `served`
 * @param {string} inUse
 * @returns {{id: string, served: boolean}[]}
 */
export function servedChoices(served, inUse) {
  const ids = (served || []).map((m) => m.id);
  const choices = ids.map((id) => ({ id, served: true }));
  if (inUse && !ids.includes(inUse)) choices.unshift({ id: inUse, served: false });
  return choices;
}

/** The chosen models the found server does not serve, once each: a save would be refused. */
export function notServed(served, chosen) {
  const ids = new Set((served || []).map((m) => m.id));
  return [...new Set((chosen || []).filter(Boolean))].filter((id) => !ids.has(id));
}

/**
 * What a failed save tells the person, from the envelope `POST /api/setup`
 * answered (or the error axios raised). `mode` "find" is the lookup of a
 * local server (`GET /api/setup/local`), whose 400 means nothing answered.
 *
 * - `reason`: the i18n key of the headline.
 * - `detail`: the server's own sentence where it adds something (which key in
 *   .env, which address answered what); for a wrong token or too many tries it
 *   would only repeat the headline.
 * - `signIn`: 401, a model is set up and the session is missing or lapsed.
 * - `forgetToken`: 403, the token is wrong, so it is dropped and asked for again.
 *
 * @param {{code?: number, msg?: string}} err
 * @param {"key" | "local" | "find"} mode
 */
export function saveFailure(err, mode) {
  const code = err?.code;
  if (code === 401) {
    return { reason: "setup_sign_in_needed", detail: "", signIn: true, forgetToken: false };
  }
  const rejected = { key: "setup_key_rejected", local: "setup_local_not_found", find: "setup_find_none" };
  const reason = {
    400: rejected[mode] || "setup_failed",
    403: "setup_token_wrong",
    409: "setup_fixed_in_env",
    429: "setup_too_many",
  }[code];
  if (!reason) {
    return { reason: "setup_failed", detail: err?.msg || "", signIn: false, forgetToken: false };
  }
  return {
    reason,
    detail: code === 400 || code === 409 ? err?.msg || "" : "",
    signIn: false,
    forgetToken: code === 403,
  };
}
