import { describe, it, expect } from "vitest";
import { resolveAltMethods } from "./authMethods";

describe("resolveAltMethods", () => {
  it("shows each provider the deployment has configured", () => {
    expect(resolveAltMethods({ showGoogle: true, showApple: true })).toEqual({
      google: true,
      apple: true,
    });
  });
  it("shows only the configured one", () => {
    expect(resolveAltMethods({ showGoogle: true, showApple: false })).toEqual({
      google: true,
      apple: false,
    });
  });
  it("shows nothing when the deployment configured neither", () => {
    expect(resolveAltMethods({})).toEqual({ google: false, apple: false });
  });
});
