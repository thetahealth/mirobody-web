import { describe, it, expect } from "vitest";

import { linkDay, linkRows, personLabel, splitLinks } from "./personalMcp.js";

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

describe("linkRows", () => {
  const me = { id: "1", name: "Ann", is_current_user: true };
  const mom = { id: "3", name: "Li Hua", nickname: "Mom", is_managed: true };
  const dad = { id: "5", name: "Dad" };

  it("puts the caller's own record first, then every member they can read", () => {
    const rows = linkRows({ own, forOthers: [forMom] }, [me, mom, dad]);
    expect(rows.map((r) => r.key)).toEqual(["self", "3", "5"]);
    expect(rows[0]).toMatchObject({ own: true, link: own, canMint: true });
    expect(rows[1]).toMatchObject({ subjectId: "3", name: "Mom", link: forMom, canMint: true });
    expect(rows[2]).toMatchObject({ subjectId: "5", name: "Dad", link: null, canMint: true });
  });

  it("offers a row for every member before any link exists", () => {
    const rows = linkRows({ own: null, forOthers: [] }, [me, mom]);
    expect(rows.map((r) => [r.key, r.link])).toEqual([["self", null], ["3", null]]);
  });

  it("leaves out a managed member who keeps their record to themselves", () => {
    const rows = linkRows({ own: null, forOthers: [] }, [me, { ...mom, can_view: false }]);
    expect(rows.map((r) => r.key)).toEqual(["self"]);
  });

  it("keeps a link whose person is off the roster, revocable but not renewable", () => {
    const gone = { id: 9, own: false, made_by_me: true, subject_id: "7", subject_name: "" };
    const rows = linkRows({ own: null, forOthers: [gone] }, [me]);
    expect(rows[1]).toMatchObject({ key: "7", name: "#7", link: gone, canMint: false });
  });

  it("matches a numeric roster id to the listing's string subject id", () => {
    const rows = linkRows({ own: null, forOthers: [forMom] }, [me, { id: 3, name: "Mom" }]);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ key: "3", link: forMom, canMint: true });
  });

  it("survives the roster before it loads: only the placeholder for me", () => {
    const rows = linkRows({ own: null, forOthers: [] }, [{ id: "", is_current_user: true }]);
    expect(rows.map((r) => r.key)).toEqual(["self"]);
    expect(linkRows({ own: null, forOthers: [] }, undefined).map((r) => r.key)).toEqual(["self"]);
  });
});
