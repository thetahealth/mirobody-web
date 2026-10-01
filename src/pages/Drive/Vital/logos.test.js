import { describe, expect, it } from "vitest";
import { providerLogo } from "./logos";

const CDN = "https://static.thetahealth.ai/res/oura.png";

describe("providerLogo", () => {
  it("uses the bundled logo for every built-in provider, never the API's URL", () => {
    for (const slug of ["apple_health", "theta_garmin", "theta_oura", "theta_whoop"]) {
      const logo = providerLogo({ slug, logo: CDN });
      expect(logo).toBeTruthy();
      expect(logo).not.toBe(CDN);
      expect(String(logo)).not.toMatch(/^https?:\/\//);
    }
  });

  it("keeps the API's logo for a provider the page does not ship", () => {
    const logo = "https://plugins.example/acme.png";
    expect(providerLogo({ slug: "acme_scale", logo })).toBe(logo);
  });

  it("is null when neither side has one", () => {
    expect(providerLogo({ slug: "acme_scale" })).toBeNull();
    expect(providerLogo(undefined)).toBeNull();
  });
});
