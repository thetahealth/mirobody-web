import { describe, it, expect } from "vitest";

import { linkDay, personLabel, splitLinks } from "./personalMcp.js";

const own = { id: 1, own: true, made_by_me: true, subject_id: "2", expires_at: "2026-10-09T08:00:00+00:00" };
const forMom = { id: 2, own: false, made_by_me: true, subject_id: "3" };
const sisters = { id: 3, own: false, made_by_me: false, creator_id: "4" };

describe("splitLinks", () => {
  it("separates the caller's own link from the ones made for others", () => {
    const { own: mine, forOthers, holders } = splitLinks({ made: [forMom, own], holders: [sisters] });
    expect(mine).toBe(own);
    expect(forOthers).toEqual([forMom]);
    expect(holders).toEqual([sisters]);
  });

  it("reads an empty or missing listing as no links", () => {
    expect(splitLinks({ made: [], holders: [] })).toEqual({ own: null, forOthers: [], holders: [] });
    expect(splitLinks(undefined)).toEqual({ own: null, forOthers: [], holders: [] });
  });
});

describe("linkDay and personLabel", () => {
  it("shows a date, and nothing for no date", () => {
    expect(linkDay(own.expires_at)).toMatch(/^2026-10-0[89]$/);
    expect(linkDay(null)).toBe("");
  });

  it("falls back to the id for an account with no name", () => {
    expect(personLabel("Mom", "3")).toBe("Mom");
    expect(personLabel("  ", "3")).toBe("#3");
  });
});
