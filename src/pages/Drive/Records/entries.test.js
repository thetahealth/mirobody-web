import { describe, it, expect } from "vitest";

import {
  countEntries,
  dayToken,
  isoDay,
  isoFromLocalInput,
  kindKey,
  localInputFromDate,
  rangeFor,
  readDays,
  readSentence,
  reasonKey,
  sentenceUnsupported,
  skipKey,
  medicationActionKey,
  entryKey,
  isMedication,
  isNote,
  standardName,
  submitBlocker,
  timeOf,
  valueOf,
  weekdayOf,
} from "./entries.js";

// A fixed day, so these tests say what day they mean instead of inheriting the
// day they run on. 2026-03-01 is deliberately the far side of a month boundary
// and of a leap-year February.
const TODAY = new Date(2026, 2, 1, 9, 5);

describe("isoDay", () => {
  it("uses the viewer's own day, not UTC's", () => {
    // 23:30 local on the 1st is the 2nd in UTC for any positive offset. The
    // feed groups by the day the person lived, so this must stay local.
    expect(isoDay(new Date(2026, 2, 1, 23, 30))).toBe("2026-03-01");
  });

  it("pads", () => {
    expect(isoDay(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("rangeFor", () => {
  it("is inclusive at both ends, so 30 days ends 29 days back", () => {
    expect(rangeFor(TODAY, 30)).toEqual({ from: "2026-01-31", to: "2026-03-01" });
  });

  it("crosses a leap February", () => {
    expect(rangeFor(TODAY, 2)).toEqual({ from: "2026-02-28", to: "2026-03-01" });
  });

  it("asks for one day when told one", () => {
    expect(rangeFor(TODAY, 1)).toEqual({ from: "2026-03-01", to: "2026-03-01" });
  });
});

describe("readDays", () => {
  it("drops a day with no entries rather than rendering an empty card", () => {
    const data = {
      days: [
        { date: "2026-03-01", entries: [{ id: 1 }] },
        { date: "2026-02-28", entries: [] },
      ],
    };
    expect(readDays(data)).toEqual([{ date: "2026-03-01", entries: [{ id: 1 }] }]);
  });

  it("survives an answer that is not the shape it claims", () => {
    expect(readDays(undefined)).toEqual([]);
    expect(readDays({})).toEqual([]);
    expect(readDays({ days: null })).toEqual([]);
    expect(readDays({ days: [{ date: "2026-03-01" }] })).toEqual([]);
  });
});

describe("standardName", () => {
  it("is the classification's name when the entry is coded", () => {
    expect(standardName({ coded: true, display: "Headache" })).toBe("Headache");
  });

  it("is empty for an abstention, and does NOT fall back to the person's words", () => {
    // The row shows both names. Falling back here would turn "we could not
    // place this" into a row that looks coded.
    expect(standardName({ coded: false, display: "", text: "打嗝" })).toBe("");
    expect(standardName({ coded: false, display: "Headache" })).toBe("");
  });
});

describe("countEntries", () => {
  it("counts across days and separates the coded ones", () => {
    const days = [
      { date: "2026-03-01", entries: [{ coded: true }, { coded: false }] },
      { date: "2026-02-28", entries: [{ coded: true }] },
    ];
    expect(countEntries(days)).toEqual({ total: 3, coded: 2 });
  });

  it("is zero for an empty log", () => {
    expect(countEntries([])).toEqual({ total: 0, coded: 0 });
  });
});

describe("dayToken", () => {
  it("names today and yesterday, and leaves the rest to the date", () => {
    expect(dayToken("2026-03-01", TODAY)).toBe("today");
    expect(dayToken("2026-02-28", TODAY)).toBe("yesterday");
    expect(dayToken("2026-02-27", TODAY)).toBe("");
  });
});

describe("timeOf", () => {
  it("is the wall clock the person saw", () => {
    expect(timeOf({ at: new Date(2026, 2, 1, 14, 30).toISOString() })).toBe("14:30");
  });

  it("is empty rather than 'Invalid Date' when the field is missing or junk", () => {
    expect(timeOf({})).toBe("");
    expect(timeOf({ at: "not a date" })).toBe("");
    expect(timeOf(null)).toBe("");
  });
});

describe("the datetime-local round trip", () => {
  it("sends an instant, not a bare wall-clock string", () => {
    // `datetime-local` has no offset. Posting its value verbatim would make
    // 14:30 mean 14:30 UTC on the server for anyone not on UTC.
    const iso = isoFromLocalInput("2026-03-01T14:30");
    expect(iso).toBe(new Date(2026, 2, 1, 14, 30).toISOString());
    expect(iso.endsWith("Z")).toBe(true);
  });

  it("round-trips through the field without drifting", () => {
    const when = new Date(2026, 2, 1, 14, 30);
    expect(localInputFromDate(when)).toBe("2026-03-01T14:30");
    expect(isoFromLocalInput(localInputFromDate(when))).toBe(when.toISOString());
  });

  it("answers empty for an empty or unparseable field", () => {
    expect(isoFromLocalInput("")).toBe("");
    expect(isoFromLocalInput("tomorrow")).toBe("");
  });
});

describe("submitBlocker", () => {
  it("lets an ordinary complaint through", () => {
    expect(submitBlocker({ text: "头痛" })).toBe("");
  });

  it("refuses whitespace, because the server would too", () => {
    expect(submitBlocker({ text: "   " })).toBe("empty");
    expect(submitBlocker({})).toBe("empty");
  });

  it("holds the server's own limits so a doomed submit never leaves", () => {
    expect(submitBlocker({ text: "x".repeat(201) })).toBe("too_long");
    expect(submitBlocker({ text: "x".repeat(200) })).toBe("");
    expect(submitBlocker({ text: "头痛", note: "y".repeat(2001) })).toBe("note_too_long");
  });

  it("measures the trimmed text, since that is what gets posted", () => {
    expect(submitBlocker({ text: `  ${"x".repeat(200)}  ` })).toBe("");
  });
});

describe("reasonKey", () => {
  it("separates the abstention the person can act on from the one they cannot", () => {
    // `ambiguous` means "your word names two codes" — a more specific word
    // fixes it. `no-match` means there is nothing to be specific about. One
    // sentence for both would throw the actionable half away.
    expect(reasonKey("icpc3:ambiguous")).toBe("journal_reason_ambiguous");
    expect(reasonKey("icpc3:no-match")).toBe("journal_reason_no_match");
    expect(reasonKey("icpc3:too-broad")).toBe("journal_reason_too_broad");
  });

  it("falls back to the generic line rather than rendering a key", () => {
    // The backend's reason vocabulary grows (`icpc3:unknown-code:ZZ99`,
    // `alias:not-standard`), and a missing i18n key renders as its own name.
    expect(reasonKey("icpc3:unknown-code:ZZ99")).toBe("journal_not_coded_hint");
    expect(reasonKey("alias:not-standard")).toBe("journal_not_coded_hint");
    expect(reasonKey("")).toBe("journal_not_coded_hint");
    expect(reasonKey(undefined)).toBe("journal_not_coded_hint");
  });
});

describe("kindKey", () => {
  it("names the two axes the endpoint writes on", () => {
    expect(kindKey("symptom")).toBe("journal_kind_symptom");
    expect(kindKey("condition")).toBe("journal_kind_condition");
  });

  it("renders nothing for a kind this build does not know", () => {
    // The server owns the enum and can grow it. Returning a key name here
    // would print "journal_kind_procedure" into the feed.
    expect(kindKey("procedure")).toBe("");
    expect(kindKey(undefined)).toBe("");
  });
});

describe("weekdayOf", () => {
  it("is the weekday of the LOCAL day, not of UTC midnight", () => {
    // `new Date("2026-03-01")` is UTC midnight, which is Feb 28 for anyone
    // west of Greenwich — the card would carry the wrong weekday there.
    expect(weekdayOf("2026-03-01", "en-US")).toBe(
      new Date(2026, 2, 1).toLocaleDateString("en-US", { weekday: "short" }),
    );
  });

  it("follows the reader's language", () => {
    expect(weekdayOf("2026-03-01", "zh-CN")).toBe("周日");
    expect(weekdayOf("2026-03-01", "ja")).toBe("日");
  });

  it("is empty for a date it cannot read", () => {
    expect(weekdayOf("", "en-US")).toBe("");
    expect(weekdayOf("not-a-date", "en-US")).toBe("");
    expect(weekdayOf(undefined, "en-US")).toBe("");
  });
});

describe("readDays guards each entry, not only the day", () => {
  it("drops a null row rather than letting it take the panel down", () => {
    // DayFeed keys on entry.id, so one null in the array throws during render
    // and the whole tab goes blank instead of one row going missing.
    const out = readDays({
      days: [{ date: "2026-03-01", entries: [null, { id: 2, text: "ok" }, undefined] }],
    });
    expect(out).toEqual([{ date: "2026-03-01", entries: [{ id: 2, text: "ok" }] }]);
  });

  it("drops a row with no id, which is the key the feed needs", () => {
    const out = readDays({ days: [{ date: "2026-03-01", entries: [{ text: "no id" }] }] });
    expect(out).toEqual([]);
  });
});


describe("a sentence", () => {
  it("is allowed 500 characters, where one entry is allowed 200", () => {
    const long = "头".repeat(300);
    expect(submitBlocker({ text: long, sentence: true })).toBe("");
    expect(submitBlocker({ text: long })).toBe("too_long");
    expect(submitBlocker({ text: "头".repeat(501), sentence: true })).toBe("sentence_too_long");
    expect(submitBlocker({ text: "  ", sentence: true })).toBe("empty");
  });

  it("reads written and skipped defensively", () => {
    const out = readSentence({
      written: [null, { id: 1, text: "头疼" }, { text: "no id" }],
      skipped: [{ quote: "没发烧", reason: "negated" }, null, {}],
      already_logged: 2,
    });
    expect(out.written).toEqual([{ id: 1, text: "头疼" }]);
    expect(out.skipped).toEqual([{ quote: "没发烧", reason: "negated" }]);
    expect(out.alreadyLogged).toBe(2);
    expect(readSentence(undefined)).toEqual({
      written: [], medications: [], medicationsFailed: false, skipped: [], alreadyLogged: 0,
    });
  });

  it("reads what the sentence did to the medication list", () => {
    const out = readSentence({
      medications: [{ text: "二甲双胍", action: "added", plan_id: "p1" }, null, {}],
      medications_failed: true,
    });
    expect(out.medications).toEqual([{ text: "二甲双胍", action: "added", plan_id: "p1" }]);
    expect(out.medicationsFailed).toBe(true);
    expect(medicationActionKey("added")).toBe("journal_med_added");
    expect(medicationActionKey("something_new")).toBe("journal_med_other");
  });

  it("keeps a listed medication, which has a plan id and no observation id", () => {
    const days = readDays({ days: [{ date: "2026-09-29", entries: [
      { id: null, plan_id: "p1", kind: "medication", text: "二甲双胍" }, { id: null }, { id: 3, kind: "note" },
    ] }] });
    expect(days[0].entries.map((e) => e.plan_id || e.id)).toEqual(["p1", 3]);
  });

  it("keys a listed medication by its plan, and knows a note from a complaint", () => {
    expect(entryKey({ id: 7 })).toBe("o:7");
    expect(entryKey({ id: null, plan_id: "p1", kind: "medication" })).toBe("m:p1");
    expect(isMedication({ kind: "medication" })).toBe(true);
    expect(isNote({ kind: "note" })).toBe(true);
    expect(kindKey("note")).toBe("journal_kind_note");
    expect(kindKey("medication")).toBe("journal_kind_medication");
    expect(reasonKey("note:free-text")).toBe("journal_reason_free_text");
  });

  it("names each skip reason the server sends, and falls back for a new one", () => {
    expect(skipKey("negated")).toBe("journal_skip_negated");
    expect(skipKey("someone_else")).toBe("journal_skip_someone_else");
    expect(skipKey("unclear")).toBe("journal_skip_unclear");
    expect(skipKey("something_new")).toBe("journal_skip_other");
  });

  it("falls back to one entry only when the server cannot read a sentence", () => {
    expect(sentenceUnsupported({ code: 503, msg: "needs a text model" })).toBe(true);
    expect(sentenceUnsupported({ response: { status: 404 } })).toBe(true);
    expect(sentenceUnsupported({ code: 502 })).toBe(false);
    expect(sentenceUnsupported({ code: 403 })).toBe(false);
  });
});

describe("a reading typed into a sentence", () => {
  it("shows its value and unit, and a complaint shows none", () => {
    expect(valueOf({ text: "收缩压", value: "150", unit: "mmHg" })).toBe("150 mmHg");
    expect(valueOf({ text: "体温", value: "38.5", unit: "" })).toBe("38.5");
    expect(valueOf({ text: "头疼", value: "" })).toBe("");
  });

  it("has a kind label, though the one-entry form does not offer it", () => {
    expect(kindKey("measurement")).toBe("journal_kind_measurement");
    expect(kindKey("meal")).toBe("");
  });
});
