/**
 * `/files/` is authenticated now. These pin the two decisions in the helper
 * that are not obvious from reading it, and that a later refactor would
 * plausibly undo.
 */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";

const ACCESS_TOKEN = "ACCESS_TOKEN";

// getApiBaseUrl reads sessionStorage; both are stubbed as plain maps.
const makeStorage = () => {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  };
};

describe("protectedFile", () => {
  let openProtectedFile;
  let resolveFileUrl;

  beforeEach(async () => {
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("sessionStorage", makeStorage());
    vi.resetModules();
    ({ openProtectedFile, resolveFileUrl } = await import("./protectedFile.js"));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  describe("resolveFileUrl", () => {
    it("turns a bare file key into a /files/ path", () => {
      expect(resolveFileUrl("uploads/20260818_1_a.pdf")).toBe(
        "/files/uploads/20260818_1_a.pdf",
      );
    });

    it("leaves an already-rooted /files/ path alone", () => {
      expect(resolveFileUrl("/files/uploads/a.pdf")).toBe("/files/uploads/a.pdf");
    });

    it("passes an absolute URL through untouched", () => {
      const url = "https://cdn.example/files/a.pdf";
      expect(resolveFileUrl(url)).toBe(url);
    });
  });

  describe("openProtectedFile", () => {
    it("refuses without a session rather than firing an anonymous request", async () => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);
      const reason = await openProtectedFile("uploads/a.pdf");
      expect(reason).toBe("file_view_unauthorized");
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("sends the token in a header and never in the URL", async () => {
      // The whole point. A token in the query string lands in browser history,
      // in Referer on sub-resources, and in every access log on the way.
      localStorage.setItem(ACCESS_TOKEN, "jwt-abc");
      const fetchSpy = vi.fn(async () => ({
        ok: true,
        blob: async () => new Blob([new Uint8Array([1])]),
      }));
      vi.stubGlobal("fetch", fetchSpy);
      vi.stubGlobal("window", { open: () => ({ location: "" }) });
      vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
      vi.stubGlobal("Blob", class { constructor(parts, opts) { this.type = opts?.type; } });
      vi.stubGlobal("setTimeout", () => 0);

      await openProtectedFile("uploads/a.pdf", "a.pdf");

      const [url, options] = fetchSpy.mock.calls[0];
      expect(url).not.toContain("access_token");
      expect(url).not.toContain("jwt-abc");
      expect(options.headers.Authorization).toBe("Bearer jwt-abc");
    });

    it("reports 401 differently from 404", async () => {
      // 404 is also what "someone else's file" returns — the backend answers
      // both identically so a key cannot be probed for existence.
      localStorage.setItem(ACCESS_TOKEN, "jwt-abc");
      vi.stubGlobal("window", { open: () => ({ close: () => {} }) });

      vi.stubGlobal("fetch", async () => ({ ok: false, status: 401 }));
      expect(await openProtectedFile("uploads/a.pdf")).toBe("file_view_unauthorized");

      vi.stubGlobal("fetch", async () => ({ ok: false, status: 404 }));
      expect(await openProtectedFile("uploads/a.pdf")).toBe("file_view_unavailable");
    });

    it("never hands back an executable type for an uploaded svg", async () => {
      // A blob: URL inherits this page's origin and .svg is an uploadable
      // extension, so rendering one as image/svg+xml runs its script here with
      // the user's session. Only non-executing formats render inline.
      localStorage.setItem(ACCESS_TOKEN, "jwt-abc");
      const types = [];
      vi.stubGlobal("fetch", async () => ({
        ok: true,
        blob: async () => ({ type: "image/svg+xml" }),
      }));
      vi.stubGlobal("window", { open: () => ({ location: "" }) });
      vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
      vi.stubGlobal("Blob", class {
        constructor(parts, opts) { types.push(opts?.type); }
      });
      vi.stubGlobal("setTimeout", () => 0);

      await openProtectedFile("uploads/evil.svg", "evil.svg");
      expect(types[0]).toBe("application/octet-stream");
    });

    it("renders a pdf inline", async () => {
      localStorage.setItem(ACCESS_TOKEN, "jwt-abc");
      const types = [];
      vi.stubGlobal("fetch", async () => ({ ok: true, blob: async () => ({ type: "" }) }));
      vi.stubGlobal("window", { open: () => ({ location: "" }) });
      vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
      vi.stubGlobal("Blob", class {
        constructor(parts, opts) { types.push(opts?.type); }
      });
      vi.stubGlobal("setTimeout", () => 0);

      await openProtectedFile("uploads/report.pdf", "report.pdf");
      expect(types[0]).toBe("application/pdf");
    });

    it("opens the tab before awaiting, or the popup blocker eats it", async () => {
      localStorage.setItem(ACCESS_TOKEN, "jwt-abc");
      const order = [];
      vi.stubGlobal("window", {
        open: () => {
          order.push("open");
          return { location: "" };
        },
      });
      vi.stubGlobal("fetch", async () => {
        order.push("fetch");
        return { ok: true, blob: async () => ({ type: "" }) };
      });
      vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
      vi.stubGlobal("Blob", class { constructor() {} });
      vi.stubGlobal("setTimeout", () => 0);

      await openProtectedFile("uploads/a.pdf", "a.pdf");
      expect(order).toEqual(["open", "fetch"]);
    });
  });
});
