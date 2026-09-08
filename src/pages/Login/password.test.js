import { describe, expect, it } from "vitest";

import {
  MIN_PASSWORD_LENGTH,
  canSubmitPassword,
  isValidPassword,
} from "./password";

describe("isValidPassword", () => {
  it("takes anything at or above the server's minimum", () => {
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH))).toBe(true);
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH + 20))).toBe(true);
  });

  it("rejects one character short, and empties", () => {
    expect(isValidPassword("a".repeat(MIN_PASSWORD_LENGTH - 1))).toBe(false);
    expect(isValidPassword("")).toBe(false);
    expect(isValidPassword(null)).toBe(false);
    expect(isValidPassword(undefined)).toBe(false);
  });

  it("counts characters, not words — spaces are a legitimate passphrase", () => {
    expect(isValidPassword("a b c d")).toBe(false); // 7
    expect(isValidPassword("a b c de")).toBe(true); // 8
  });
});

describe("canSubmitPassword", () => {
  it("needs both halves", () => {
    expect(canSubmitPassword({ email: "a@b", password: "longenough" })).toBe(true);
    expect(canSubmitPassword({ email: "a@b", password: "short" })).toBe(false);
    expect(canSubmitPassword({ email: "nope", password: "longenough" })).toBe(false);
    expect(canSubmitPassword({})).toBe(false);
  });

  it("accepts the dotless demo addresses the code form accepts", () => {
    // `user5086@demo` and `caregiver@mirobody.ai` must both pass; requiring a
    // TLD here would lock out the seeded demo account.
    expect(canSubmitPassword({ email: "user5086@demo", password: "longenough" })).toBe(true);
    expect(
      canSubmitPassword({ email: "caregiver@mirobody.ai", password: "longenough" }),
    ).toBe(true);
  });
});
