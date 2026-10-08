import { describe, expect, it } from "vitest";

import { SETUP_SKIPPED, SETUP_TOKEN } from "../../enum/storage.js";
import {
  answerTime,
  badModelName,
  captureSetupToken,
  guessPlatform,
  isReady,
  keyChoice,
  localChoice,
  localModels,
  modelDraft,
  modelEditable,
  modelInEffect,
  modelToSend,
  needsSignIn,
  notServed,
  offersDefault,
  oneDecimal,
  pickTier,
  presetModels,
  rememberSetupToken,
  saveFailure,
  sendsToSetup,
  servedChoices,
  setupSkipped,
  skipSetup,
  startCommand,
  tierBadge,
  tierFor,
  tierHardware,
  tierOnServer,
} from "./setup";

// The parts of `window` the token helpers touch.
const fakeWindow = (url, { storage = new Map(), state = { idx: 3 }, storageThrows = false } = {}) => {
  const u = new URL(url, "http://localhost:18060");
  const replaced = [];
  const sessionStorage = {
    getItem: (k) => {
      if (storageThrows) throw new Error("SecurityError");
      return storage.has(k) ? storage.get(k) : null;
    },
    setItem: (k, v) => {
      if (storageThrows) throw new Error("SecurityError");
      storage.set(k, String(v));
    },
    removeItem: (k) => {
      if (storageThrows) throw new Error("SecurityError");
      storage.delete(k);
    },
  };
  return {
    location: { pathname: u.pathname, search: u.search, hash: u.hash },
    history: { state, replaceState: (s, _title, next) => replaced.push({ state: s, url: next }) },
    sessionStorage,
    storage,
    replaced,
  };
};

describe("captureSetupToken", () => {
  it("takes the token from the link, keeps it for the tab and strips it from the URL", () => {
    const win = fakeWindow("/setup?token=abc123");
    expect(captureSetupToken(win)).toBe("abc123");
    expect(win.storage.get(SETUP_TOKEN)).toBe("abc123");
    expect(win.replaced).toEqual([{ state: { idx: 3 }, url: "/setup" }]);
  });

  it("keeps the rest of the query, the hash and the router's history state", () => {
    const win = fakeWindow("/setup?lang=ja&token=abc123#local", { state: { usr: null, idx: 7 } });
    captureSetupToken(win);
    expect(win.replaced).toEqual([{ state: { usr: null, idx: 7 }, url: "/setup?lang=ja#local" }]);
    expect(win.replaced[0].url).not.toContain("abc123");
  });

  it("falls back to the token this tab kept, touching no URL", () => {
    const win = fakeWindow("/setup", { storage: new Map([[SETUP_TOKEN, "kept"]]) });
    expect(captureSetupToken(win)).toBe("kept");
    expect(win.replaced).toEqual([]);
  });

  it("prefers a new link over a kept token", () => {
    const win = fakeWindow("/setup?token=new", { storage: new Map([[SETUP_TOKEN, "old"]]) });
    expect(captureSetupToken(win)).toBe("new");
    expect(win.storage.get(SETUP_TOKEN)).toBe("new");
  });

  it("answers empty when there is neither", () => {
    expect(captureSetupToken(fakeWindow("/setup"))).toBe("");
    expect(captureSetupToken(fakeWindow("/setup?token="))).toBe("");
  });

  it("still strips the URL when storage is off, and returns the token for the page to hold", () => {
    const win = fakeWindow("/setup?token=abc123", { storageThrows: true });
    expect(captureSetupToken(win)).toBe("abc123");
    expect(win.replaced[0].url).toBe("/setup");
    expect(captureSetupToken(fakeWindow("/setup", { storageThrows: true }))).toBe("");
  });
});

describe("rememberSetupToken", () => {
  it("keeps a token and forgets on empty", () => {
    const win = fakeWindow("/setup");
    rememberSetupToken("t1", win);
    expect(win.storage.get(SETUP_TOKEN)).toBe("t1");
    rememberSetupToken("", win);
    expect(win.storage.has(SETUP_TOKEN)).toBe(false);
  });

  it("does not throw without storage", () => {
    expect(() => rememberSetupToken("t1", fakeWindow("/", { storageThrows: true }))).not.toThrow();
  });
});

describe("sendsToSetup", () => {
  const needed = { modelSetup: "needed", skipped: false };

  it("sends every page there while a model is needed, the sign-in page included", () => {
    expect(sendsToSetup({ ...needed, pathname: "/" })).toBe(true);
    expect(sendsToSetup({ ...needed, pathname: "/login" })).toBe(true);
    expect(sendsToSetup({ ...needed, pathname: "/ask/abc" })).toBe(true);
  });

  it("leaves the setup page and the pages opened from a link made for someone", () => {
    for (const pathname of ["/setup", "/mcplogin", "/share/abc", "/activate"]) {
      expect(sendsToSetup({ ...needed, pathname })).toBe(false);
    }
  });

  it("stops once the tab put it off, or a model is ready, or the server never said", () => {
    expect(sendsToSetup({ ...needed, skipped: true, pathname: "/" })).toBe(false);
    expect(sendsToSetup({ modelSetup: "ready", skipped: false, pathname: "/" })).toBe(false);
    expect(sendsToSetup({ modelSetup: "", skipped: false, pathname: "/" })).toBe(false);
  });

  it("reads the put-off flag skipSetup writes", () => {
    const win = fakeWindow("/");
    expect(setupSkipped(win)).toBe(false);
    skipSetup(win);
    expect(win.storage.get(SETUP_SKIPPED)).toBe("1");
    expect(setupSkipped(win)).toBe(true);
    expect(setupSkipped(fakeWindow("/", { storageThrows: true }))).toBe(false);
  });
});

describe("guessPlatform", () => {
  it("picks llama.cpp itself on a Mac or a Windows PC, and the no-GPU container elsewhere", () => {
    expect(guessPlatform({ userAgentData: { platform: "macOS" } })).toBe("mac");
    expect(guessPlatform({ platform: "MacIntel" })).toBe("mac");
    expect(guessPlatform({ platform: "Win32" })).toBe("windows");
    expect(guessPlatform({ userAgentData: { platform: "Windows" } })).toBe("windows");
    expect(guessPlatform({ userAgentData: { platform: "Linux" } })).toBe("cpu");
    expect(guessPlatform({ platform: "Linux x86_64" })).toBe("cpu");
    expect(guessPlatform({ userAgentData: { platform: "Chrome OS" } })).toBe("cpu");
    expect(guessPlatform({})).toBe("cpu");
  });
});

describe("startCommand", () => {
  it("runs llama.cpp itself on a Mac, with the server's preset", () => {
    expect(startCommand("mac", "docker/local-models.ini")).toBe(
      "brew install llama.cpp\nllama-server --models-preset docker/local-models.ini --port 8080 --models-max 2",
    );
  });

  it("installs the Vulkan build on Windows, with the preset in Windows' separators", () => {
    expect(startCommand("windows", "docker/local-models.ini")).toBe(
      "winget install --id ggml.llamacpp\nllama-server --models-preset docker\\local-models.ini --port 8080 --models-max 2",
    );
  });

  it("starts the compose profile elsewhere, and has no one command for other setups", () => {
    expect(startCommand("gpu", "x")).toBe("docker compose --profile local up -d");
    expect(startCommand("cpu", "x")).toBe("docker compose --profile local-cpu up -d");
    expect(startCommand("other", "x")).toBe("");
  });
});

describe("localModels", () => {
  it("lists each model once, in role order, with its status", () => {
    const local = {
      models: { agent: "qwen3.8-27b", utils: "qwen3.8-27b", ocr: "glm-ocr-0.9b" },
      status: { agent: "loading", utils: "loading", ocr: "loaded" },
    };
    expect(localModels(local)).toEqual([
      { model: "qwen3.8-27b", status: "loading" },
      { model: "glm-ocr-0.9b", status: "loaded" },
    ]);
  });

  it("says missing where the server reported nothing, and skips an unnamed role", () => {
    expect(localModels({ models: { agent: "a", utils: "", ocr: "b" } })).toEqual([
      { model: "a", status: "missing" },
      { model: "b", status: "missing" },
    ]);
    expect(localModels(undefined)).toEqual([]);
  });

  it("counts loaded (llama.cpp) and ready (any other server) as ready", () => {
    expect(isReady("loaded")).toBe(true);
    expect(isReady("ready")).toBe(true);
    expect(isReady("loading")).toBe(false);
    expect(isReady("unloaded")).toBe(false);
    expect(isReady("missing")).toBe(false);
  });
});

describe("needsSignIn", () => {
  it("takes the token alone while no model is set up", () => {
    expect(needsSignIn({ needed: true, signedIn: false })).toBe(false);
  });

  it("takes a sign-in as well once one is", () => {
    expect(needsSignIn({ needed: false, signedIn: false })).toBe(true);
    expect(needsSignIn({ needed: false, signedIn: true })).toBe(false);
  });

  it("does not ask when the server did not say", () => {
    expect(needsSignIn({ needed: undefined, signedIn: false })).toBe(false);
  });
});

describe("saveFailure", () => {
  it("sends a 401 to the sign-in page instead of showing an error", () => {
    expect(saveFailure({ code: 401, msg: "Sign in to change the model." }, "key")).toEqual({
      reason: "setup_sign_in_needed",
      detail: "",
      signIn: true,
      forgetToken: false,
    });
  });

  it("forgets a wrong token so the page asks for it again", () => {
    const failure = saveFailure({ code: 403, msg: "The setup token is wrong." }, "key");
    expect(failure).toMatchObject({ reason: "setup_token_wrong", forgetToken: true, signIn: false });
    expect(failure.detail).toBe("");
  });

  it("names what the server refused, with its sentence where it adds something", () => {
    expect(saveFailure({ code: 400, msg: "The key did not work: AuthenticationError" }, "key")).toMatchObject({
      reason: "setup_key_rejected",
      detail: "The key did not work: AuthenticationError",
    });
    expect(saveFailure({ code: 400, msg: "No model server answered" }, "local")).toMatchObject({
      reason: "setup_local_not_found",
      detail: "No model server answered",
    });
    expect(saveFailure({ code: 409, msg: "OPENAI_API_KEY is set in .env" }, "key")).toMatchObject({
      reason: "setup_fixed_in_env",
      detail: "OPENAI_API_KEY is set in .env",
    });
    expect(saveFailure({ code: 429, msg: "Too many" }, "key")).toMatchObject({
      reason: "setup_too_many",
      detail: "",
      forgetToken: false,
    });
  });

  it("reads a failed lookup of the local server as nothing answering", () => {
    expect(saveFailure({ code: 400, msg: "No model server answered at http://llama:8080/v1." }, "find")).toMatchObject({
      reason: "setup_find_none",
      detail: "No model server answered at http://llama:8080/v1.",
    });
    expect(saveFailure({ code: 403, msg: "wrong" }, "find")).toMatchObject({ forgetToken: true });
  });

  it("falls back to a generic headline, with whatever the server said", () => {
    expect(saveFailure({ code: 500, msg: "boom" }, "key")).toEqual({
      reason: "setup_failed",
      detail: "boom",
      signIn: false,
      forgetToken: false,
    });
    // An axios error (timeout, no network) has a string code and no msg.
    expect(saveFailure({ code: "ECONNABORTED", name: "AxiosError" }, "local")).toMatchObject({
      reason: "setup_failed",
      detail: "",
    });
    expect(saveFailure(undefined, "key").reason).toBe("setup_failed");
  });
});

// `GET /api/setup`'s shape for one model.
const field = (over = {}) => ({
  model: "anthropic/claude-sonnet-5",
  default: "anthropic/claude-sonnet-5",
  env: "OPENROUTER_CHAT_MODEL",
  in_env_file: false,
  ...over,
});

describe("model fields", () => {
  it("start as the model in use, else the configured one", () => {
    expect(modelDraft(field({ model: "x/changed" }))).toBe("x/changed");
    expect(modelDraft(field({ model: "" }))).toBe("anthropic/claude-sonnet-5");
    expect(modelDraft(undefined)).toBe("");
  });

  it("are the page's to change only with a variable that .env does not set", () => {
    expect(modelEditable(field())).toBe(true);
    expect(modelEditable(field({ in_env_file: true }))).toBe(false);
    expect(modelEditable(field({ env: "" }))).toBe(false);
    expect(modelEditable(undefined)).toBe(false);
  });

  it("refuse a name with spaces, as the server does", () => {
    expect(badModelName("anthropic/claude sonnet")).toBe(true);
    expect(badModelName("x".repeat(201))).toBe(true);
    expect(badModelName("  qwen3.8-flash  ")).toBe(false);
    expect(badModelName("")).toBe(false);
  });
});

describe("modelToSend", () => {
  it("sends a name only when the person changed it", () => {
    expect(modelToSend(field(), "anthropic/claude-sonnet-5")).toBe("");
    expect(modelToSend(field(), " anthropic/claude-opus-5 ")).toBe("anthropic/claude-opus-5");
  });

  it("keeps the model in use for an emptied field, as the server reads empty", () => {
    expect(modelToSend(field({ model: "x/changed" }), "  ")).toBe("");
  });

  it("sends the default back over a changed name, which the server stores as nothing", () => {
    expect(modelToSend(field({ model: "x/changed" }), "anthropic/claude-sonnet-5")).toBe(
      "anthropic/claude-sonnet-5",
    );
  });

  it("sends nothing for a model .env fixes or the config names no variable for", () => {
    expect(modelToSend(field({ in_env_file: true }), "x/other")).toBe("");
    expect(modelToSend(field({ env: "" }), "x/other")).toBe("");
    expect(modelToSend(undefined, "x/other")).toBe("");
  });
});

describe("offersDefault", () => {
  it("offers the default only while the field holds something else", () => {
    expect(offersDefault(field(), "anthropic/claude-sonnet-5")).toBe(false);
    expect(offersDefault(field(), "x/other")).toBe(true);
    expect(offersDefault(field(), "")).toBe(true);
  });

  it("does not offer it where there is none, or the field cannot change", () => {
    expect(offersDefault(field({ default: "" }), "x/other")).toBe(false);
    expect(offersDefault(field({ in_env_file: true }), "x/other")).toBe(false);
  });
});

describe("modelInEffect", () => {
  it("names what a save would leave running", () => {
    expect(modelInEffect(field(), "x/typed")).toBe("x/typed");
    expect(modelInEffect(field({ model: "x/in-use" }), "")).toBe("x/in-use");
    expect(modelInEffect(field({ in_env_file: true, model: "x/env" }), "x/typed")).toBe("x/env");
    expect(modelInEffect(undefined, "x/typed")).toBe("");
  });
});

describe("keyChoice", () => {
  const chatField = field();
  const utilsField = field({ model: "google/gemini-3-flash", default: "google/gemini-3-flash", env: "OPENROUTER_UTILS_MODEL" });

  it("sends the key alone when no model name changed", () => {
    expect(
      keyChoice({
        provider: "OPENROUTER_API_KEY",
        apiKey: " sk-or-1 ",
        chatField,
        chatTyped: chatField.model,
        utilsField,
        utilsTyped: utilsField.model,
      }),
    ).toEqual({ mode: "key", name: "OPENROUTER_API_KEY", value: "sk-or-1" });
  });

  it("adds each changed name under its own field", () => {
    expect(
      keyChoice({
        provider: "OPENROUTER_API_KEY",
        apiKey: "sk-or-1",
        chatField,
        chatTyped: "anthropic/claude-opus-5",
        utilsField,
        utilsTyped: "google/gemini-3-flash-lite",
      }),
    ).toEqual({
      mode: "key",
      name: "OPENROUTER_API_KEY",
      value: "sk-or-1",
      model: "anthropic/claude-opus-5",
      utils_model: "google/gemini-3-flash-lite",
    });
  });

  it("works for a server that sends no model fields", () => {
    expect(keyChoice({ provider: "OPENAI_API_KEY", apiKey: "sk-1", chatTyped: "gpt-x" })).toEqual({
      mode: "key",
      name: "OPENAI_API_KEY",
      value: "sk-1",
    });
  });
});

describe("localChoice", () => {
  const agentField = field({ model: "qwen3.8-27b", default: "qwen3.8-27b", env: "LOCAL_MODEL" });
  const ocrField = field({ model: "glm-ocr-0.9b", default: "glm-ocr-0.9b", env: "LOCAL_OCR_MODEL" });

  it("sends the address alone without a lookup, or when nothing changed", () => {
    expect(localChoice({ baseUrl: "" })).toEqual({ mode: "local", base_url: "" });
    expect(
      localChoice({ baseUrl: " http://llama:8080/v1 ", agentField, agentChosen: "qwen3.8-27b", ocrField, ocrChosen: "glm-ocr-0.9b" }),
    ).toEqual({ mode: "local", base_url: "http://llama:8080/v1" });
  });

  it("sends the agent as `model` and the reader as `ocr_model`", () => {
    expect(
      localChoice({ baseUrl: "http://llama:8080/v1", agentField, agentChosen: "qwen3.8-9b", ocrField, ocrChosen: "glm-ocr-1.2b" }),
    ).toEqual({ mode: "local", base_url: "http://llama:8080/v1", model: "qwen3.8-9b", ocr_model: "glm-ocr-1.2b" });
  });
});

describe("served models", () => {
  const served = [
    { id: "glm-ocr-0.9b", status: "loaded" },
    { id: "qwen3.8-9b", status: "unloaded" },
  ];

  it("offers what the server serves, and the model in use first when it does not serve it", () => {
    expect(servedChoices(served, "glm-ocr-0.9b")).toEqual([
      { id: "glm-ocr-0.9b", served: true },
      { id: "qwen3.8-9b", served: true },
    ]);
    expect(servedChoices(served, "qwen3.8-27b")).toEqual([
      { id: "qwen3.8-27b", served: false },
      { id: "glm-ocr-0.9b", served: true },
      { id: "qwen3.8-9b", served: true },
    ]);
    expect(servedChoices(undefined, "")).toEqual([]);
  });

  it("names each chosen model the server does not serve, once", () => {
    expect(notServed(served, ["qwen3.8-9b", "glm-ocr-0.9b"])).toEqual([]);
    expect(notServed(served, ["qwen3.8-27b", "glm-ocr-0.9b"])).toEqual(["qwen3.8-27b"]);
    expect(notServed(served, ["qwen3.8-27b", "qwen3.8-27b"])).toEqual(["qwen3.8-27b"]);
    expect(notServed(served, ["", "glm-ocr-0.9b"])).toEqual([]);
    expect(notServed([], ["a"])).toEqual(["a"]);
  });
});

// `local.tiers` as config.llm.yaml writes it today.
const TIERS = [
  { id: "small", agent: "minicpm5-2b", ocr: "glm-ocr", sees: false, download_gb: 3, memory_gb: 5.7, answer_s: 28, checks: null, measured_on: "Apple silicon GPU (Metal), 16 GB" },
  { id: "large", agent: "qwen3.8-27b", ocr: "glm-ocr", sees: true, download_gb: 14.5, memory_gb: 20, answer_s: 134, checks: null, measured_on: "Apple silicon GPU (Metal), 48 GB" },
];
const agentField = (model, def = "minicpm5-2b") => ({ model, default: def, env: "LOCAL_MODEL", in_env_file: false });

describe("pickTier", () => {
  it("opens on the size running here once local models are set up", () => {
    expect(pickTier({ tiers: TIERS, configured: true, model_fields: { agent: agentField("minicpm5-2b") } })).toBe("small");
    expect(pickTier({ tiers: TIERS, configured: true, model_fields: { agent: agentField("qwen3.8-27b") } })).toBe("large");
  });

  it("reads `models.agent` when the server sends no model fields", () => {
    expect(pickTier({ tiers: TIERS, configured: true, models: { agent: "qwen3.8-27b" } })).toBe("large");
  });

  it("takes a model LOCAL_MODEL names as running, before local models are set up", () => {
    expect(pickTier({ tiers: TIERS, configured: false, model_fields: { agent: agentField("qwen3.8-27b") } })).toBe("large");
  });

  it("opens a new deployment on small, not on the config's default for an entry nothing calls", () => {
    expect(pickTier({ tiers: TIERS, configured: false, model_fields: { agent: agentField("qwen3.8-27b", "qwen3.8-27b") } })).toBe("small");
    expect(pickTier({ tiers: TIERS })).toBe("small");
  });

  it("opens on small when what runs is no size, and on the first when there is no small", () => {
    expect(pickTier({ tiers: TIERS, configured: true, model_fields: { agent: agentField("my-own-model") } })).toBe("small");
    expect(pickTier({ tiers: [TIERS[1]], configured: true, models: { agent: "x" } })).toBe("large");
    expect(pickTier({ tiers: [] })).toBe("");
    expect(pickTier(undefined)).toBe("");
  });
});

describe("tierFor", () => {
  it("names the size a pair makes up, and none for another pair", () => {
    expect(tierFor(TIERS, "minicpm5-2b", "glm-ocr")?.id).toBe("small");
    expect(tierFor(TIERS, "minicpm5-2b", "other-ocr")).toBeNull();
    expect(tierFor(undefined, "a", "b")).toBeNull();
  });
});

describe("figures", () => {
  it("prints sizes with one decimal, and null for an unmeasured one", () => {
    expect(oneDecimal(3)).toBe("3.0");
    expect(oneDecimal(14.5)).toBe("14.5");
    expect(oneDecimal(2.64)).toBe("2.6");
    expect(oneDecimal(null)).toBeNull();
    expect(oneDecimal(undefined)).toBeNull();
    expect(oneDecimal(Number.NaN)).toBeNull();
  });

  it("reads an answer time in seconds under a minute and a half, else in minutes", () => {
    expect(answerTime(134)).toEqual({ unit: "min", n: 2 });
    expect(answerTime(45.4)).toEqual({ unit: "sec", n: 45 });
    expect(answerTime(89)).toEqual({ unit: "sec", n: 89 });
    expect(answerTime(null)).toBeNull();
    expect(answerTime(0)).toBeNull();
  });

  it("gives every size of today's config a hardware line, and the two ends a badge", () => {
    expect(TIERS.map((tier) => tierHardware(tier.id))).toEqual([
      "setup_tier_hw_light",
      "setup_tier_hw_large",
    ]);
    expect(TIERS.map((tier) => tierBadge(tier.id))).toEqual([
      "setup_tier_badge_light",
      "setup_tier_badge_best",
    ]);
    expect(tierHardware("huge")).toBe("");
  });
});

describe("tierOnServer", () => {
  const served = [
    { id: "glm-ocr", status: "loaded" },
    { id: "minicpm5-2b", status: "unloaded" },
    { id: "qwen3.8-27b", status: "loaded" },
    { id: "openbmb/MiniCPM5-2B-GGUF:Q4_K_M", status: "ready" },
  ];

  it("is loaded when both models are", () => {
    expect(tierOnServer(TIERS[1], served)).toBe("loaded");
  });

  it("is unloaded while either is listed but not loaded: the server can fetch it", () => {
    expect(tierOnServer(TIERS[0], served)).toBe("unloaded");
    expect(tierOnServer(TIERS[0], [{ id: "glm-ocr", status: "loading" }, { id: "minicpm5-2b", status: "loaded" }])).toBe(
      "unloaded",
    );
  });

  it("is missing when either is not listed, a cached file under its repo id included", () => {
    expect(tierOnServer(TIERS[1], [{ id: "glm-ocr", status: "loaded" }])).toBe("missing");
    expect(tierOnServer(TIERS[0], [{ id: "openbmb/MiniCPM5-2B-GGUF:Q4_K_M", status: "ready" }, { id: "glm-ocr", status: "loaded" }])).toBe(
      "missing",
    );
    expect(tierOnServer(TIERS[0], undefined)).toBe("missing");
  });

  it("offers the preset's models by name, not the cache's repo ids", () => {
    expect(presetModels(served).map((m) => m.id)).toEqual(["glm-ocr", "minicpm5-2b", "qwen3.8-27b"]);
    expect(presetModels(undefined)).toEqual([]);
  });
});
