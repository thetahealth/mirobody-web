import { describe, it, expect } from "vitest";
import { isValidEmail, canSubmit } from "./emailOtp";

describe("emailOtp helpers", () => {
  it("validates email (lenient — no TLD required for demo accounts)", () => {
    expect(isValidEmail("a@b.co")).toBe(true);
    expect(isValidEmail("user10@demo")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("")).toBe(false);
    expect(isValidEmail("a@")).toBe(false);
    expect(isValidEmail("@b")).toBe(false);
  });
  it("gates submit on valid email + non-empty code", () => {
    expect(canSubmit({ email: "user10@demo", code: "000000" })).toBe(true);
    expect(canSubmit({ email: "a@b.co", code: "1234" })).toBe(true);
    expect(canSubmit({ email: "a@b.co", code: "" })).toBe(false);
    expect(canSubmit({ email: "a@b.co", code: "   " })).toBe(false);
    expect(canSubmit({ email: "bad", code: "1234" })).toBe(false);
  });
});
