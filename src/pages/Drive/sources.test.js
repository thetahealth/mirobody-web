import { describe, expect, it } from "vitest";
import { sourcesView } from "./sources";

describe("sourcesView", () => {
  it("is empty when the deployment turns device sources off", () => {
    expect(sourcesView({ enabled: false, count: 0, loading: false, answered: true })).toBe("empty");
  });

  it("is pending before the first answer, not empty", () => {
    expect(sourcesView({ enabled: true, count: 0, loading: false, answered: false })).toBe("pending");
    expect(sourcesView({ enabled: true, count: 0, loading: true, answered: false })).toBe("pending");
  });

  it("is pending while a refresh is in flight", () => {
    expect(sourcesView({ enabled: true, count: 0, loading: true, answered: true })).toBe("pending");
  });

  it("is empty only once the answer says there is nothing", () => {
    expect(sourcesView({ enabled: true, count: 0, loading: false, answered: true })).toBe("empty");
  });

  it("lists whatever the answer holds", () => {
    expect(sourcesView({ enabled: true, count: 3, loading: false, answered: true })).toBe("list");
  });
});
