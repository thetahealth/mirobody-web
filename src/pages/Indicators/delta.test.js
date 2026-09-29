import { describe, it, expect } from "vitest";

import { cursorKey, sourceChips, sourceLabelKey, visitCursor } from "./delta.js";

const memory = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v), m };
};

describe("visit cursor", () => {
  it("has no previous visit the first time, and records this one", () => {
    const s = memory();
    const first = visitCursor("7", s, () => new Date("2026-09-29T08:00:00Z"));
    expect(first.since).toBeNull();
    first.record();
    expect(visitCursor("7", s).since).toBe("2026-09-29T08:00:00.000Z");
  });

  it("keeps one cursor per person viewed", () => {
    const s = memory();
    visitCursor("7", s, () => new Date("2026-09-29T08:00:00Z")).record();
    expect(visitCursor("8", s).since).toBeNull();
    expect(cursorKey(undefined)).toBe("mirobody:last-data-visit:self");
  });

  it("survives a browser that refuses storage", () => {
    const broken = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    const c = visitCursor("7", broken);
    expect(c.since).toBeNull();
    expect(() => c.record()).not.toThrow();
  });
});

describe("source chips", () => {
  it("orders by source, drops empty buckets, and keeps unknown ones last", () => {
    expect(sourceChips([
      { name: "api", count: 2 }, { name: "vendor-x", count: 1 },
      { name: "device", count: 0 }, { name: "file", count: "3" }, { name: "manual", count: 1 },
    ])).toEqual([
      { name: "file", count: 3 }, { name: "manual", count: 1 },
      { name: "api", count: 2 }, { name: "vendor-x", count: 1 },
    ]);
  });

  it("labels the four known sources and leaves others to their name", () => {
    expect(sourceLabelKey("manual")).toBe("source_kind_manual");
    expect(sourceLabelKey("vendor-x")).toBeNull();
  });
});
