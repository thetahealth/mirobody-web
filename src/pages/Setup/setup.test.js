import { describe, expect, it } from "vitest";

import { SETUP_SKIPPED, SETUP_TOKEN } from "../../enum/storage.js";
import {
  captureSetupToken,
  guessPlatform,
  isReady,
  localModels,
  needsSignIn,
  rememberSetupToken,
  saveFailure,
  sendsToSetup,
  setupSkipped,
  skipSetup,
  startCommand,
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
  it("picks the Mac tab on a Mac and the GPU container elsewhere", () => {
    expect(guessPlatform({ userAgentData: { platform: "macOS" } })).toBe("mac");
    expect(guessPlatform({ platform: "MacIntel" })).toBe("mac");
    expect(guessPlatform({ platform: "Win32" })).toBe("gpu");
    expect(guessPlatform({ userAgentData: { platform: "Linux" } })).toBe("gpu");
    expect(guessPlatform({})).toBe("gpu");
  });
});

describe("startCommand", () => {
  it("runs llama.cpp itself on a Mac, with the server's preset", () => {
    expect(startCommand("mac", "docker/local-models.ini")).toBe(
      "brew install llama.cpp\nllama-server --models-preset docker/local-models.ini --port 8080",
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
