/**
 * `/files/` is authenticated now. These pin the decisions in the helper that
 * are not obvious from reading it, and that a later refactor would plausibly
 * undo.
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

const encode = (text) => new TextEncoder().encode(text);
const PDF = encode("%PDF-1.7\n1 0 obj\n");
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
// What a reverse proxy without a `/files/` rule answers: the app's own page.
const INDEX_HTML = encode('<!doctype html><html><body><div id="root"></div></body></html>');

// A 200 as fetch resolves it. `slice()` so the buffer is exactly the bytes.
const fileResponse = (bytes, contentType) => ({
  ok: true,
  status: 200,
  headers: new Headers({ "Content-Type": contentType }),
  arrayBuffer: async () => bytes.slice().buffer,
});

// What a fetch whose answer never comes does: nothing, until it is aborted.
const untilAborted = (signal) =>
  new Promise((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason));
  });

describe("protectedFile", () => {
  let openProtectedFile;
  let resolveFileUrl;
  let FILE_FETCH_TIMEOUT_MS;

  beforeEach(async () => {
    vi.stubGlobal("localStorage", makeStorage());
    vi.stubGlobal("sessionStorage", makeStorage());
    vi.resetModules();
    ({ openProtectedFile, resolveFileUrl, FILE_FETCH_TIMEOUT_MS } = await import("./protectedFile.js"));
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
      const fetchSpy = vi.fn(async () => fileResponse(PDF, "application/pdf"));
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
      vi.stubGlobal("fetch", async () =>
        fileResponse(encode("<svg xmlns='http://www.w3.org/2000/svg'/>"), "image/svg+xml"),
      );
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
      vi.stubGlobal("fetch", async () => fileResponse(PDF, "application/pdf"));
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
        return fileResponse(PDF, "application/pdf");
      });
      vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
      vi.stubGlobal("Blob", class { constructor() {} });
      vi.stubGlobal("setTimeout", () => 0);

      await openProtectedFile("uploads/a.pdf", "a.pdf");
      expect(order).toEqual(["open", "fetch"]);
    });

    // The tab is open before the request starts, so any way the request can go
    // wrong without throwing ends with a blank tab and no toast.
    describe("when the answer is not the file, or never comes", () => {
      let tab;
      let types;

      beforeEach(() => {
        vi.useFakeTimers();
        localStorage.setItem(ACCESS_TOKEN, "jwt-abc");
        tab = { location: "", close: vi.fn() };
        types = [];
        vi.stubGlobal("window", { open: () => tab });
        vi.stubGlobal("URL", { createObjectURL: () => "blob:x", revokeObjectURL: () => {} });
        vi.stubGlobal("Blob", class {
          constructor(parts, opts) { types.push(opts?.type); }
        });
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it.each([
        ["the headers never come", (_, { signal }) => untilAborted(signal)],
        // A timer cleared once the headers arrive would miss this one.
        [
          "the body stops after the headers",
          async (_, { signal }) => ({
            ok: true,
            status: 200,
            headers: new Headers({ "Content-Type": "application/pdf" }),
            arrayBuffer: () => untilAborted(signal),
          }),
        ],
      ])("gives up and closes the tab when %s", async (_, fetchImpl) => {
        vi.stubGlobal("fetch", fetchImpl);

        const pending = openProtectedFile("uploads/report.pdf", "report.pdf");
        await vi.advanceTimersByTimeAsync(FILE_FETCH_TIMEOUT_MS - 1);
        expect(tab.close).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(1);
        expect(await pending).toBe("file_view_unavailable");
        expect(tab.close).toHaveBeenCalled();
      });

      it.each([
        ["report.pdf", "text/html; charset=utf-8"],
        // The page says it is a PDF; its bytes say otherwise.
        ["report.pdf", "application/pdf"],
        ["scan.png", "text/html; charset=utf-8"],
        ["labs.csv", "text/html; charset=utf-8"],
      ])("refuses a 200 index.html for %s served as %s", async (name, contentType) => {
        vi.stubGlobal("fetch", async () => fileResponse(INDEX_HTML, contentType));

        expect(await openProtectedFile(`uploads/${name}`, name)).toBe("file_view_not_file");
        expect(tab.close).toHaveBeenCalled();
        expect(types).toEqual([]);
      });

      it.each([
        ["report.pdf", "application/pdf", PDF],
        // Viewers take a header anywhere in the first 1024 bytes; so does this.
        ["scan.pdf", "application/pdf", new Uint8Array([...encode("\r\n\r\n"), ...PDF])],
        ["scan.png", "image/png", PNG],
        // A stored key whose extension differs from the name: still an image,
        // and the browser sniffs which.
        ["scan.png", "image/jpeg", PNG],
        ["labs.csv", "text/csv", encode("date,value\n")],
      ])("still opens %s served as %s", async (name, contentType, bytes) => {
        vi.stubGlobal("fetch", async () => fileResponse(bytes, contentType));

        expect(await openProtectedFile(`uploads/${name}`, name)).toBeNull();
        expect(tab.close).not.toHaveBeenCalled();
        expect(tab.location).toBe("blob:x");
      });
    });
  });
});
