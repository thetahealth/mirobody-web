import { describe, expect, it } from "vitest";

import { parseModelEntry } from "./modelLabels";

describe("parseModelEntry", () => {
  it("shows the model and keeps the entry's name as what is sent", () => {
    expect(parseModelEntry({ name: "local", model: "qwen3.8-27b" })).toEqual({
      id: "local",
      provider: "local",
      show_name: "qwen3.8-27b",
    });
  });

  it("keeps a label the server disambiguated, as given", () => {
    // Two entries running one model come back as "model (entry)".
    expect(parseModelEntry({ name: "or-fast", model: "gemini-3-flash (or-fast)" }).show_name).toBe(
      "gemini-3-flash (or-fast)",
    );
  });

  it("shows the name when there is no model to show", () => {
    expect(parseModelEntry({ name: "local", model: "" }).show_name).toBe("local");
    expect(parseModelEntry({ name: "local" }).show_name).toBe("local");
  });

  it("reads a bare name, which a server without labels answers", () => {
    expect(parseModelEntry("gpt-5.2")).toEqual({
      id: "gpt-5.2",
      provider: "gpt-5.2",
      show_name: "gpt-5.2",
    });
  });

  it("answers an empty id for an entry with no name, which the store drops", () => {
    expect(parseModelEntry({ model: "orphan" }).id).toBe("");
    expect(parseModelEntry(null).id).toBe("");
  });
});
