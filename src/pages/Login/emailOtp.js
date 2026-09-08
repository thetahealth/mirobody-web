// Pure helpers for the email-OTP form. Kept framework-free so they unit-test in
// the repo's node-env vitest setup (src/**/*.test.js).

// Lenient on purpose: require only "x@y" (an @ with non-empty sides), NOT a TLD.
// Demo / internal accounts like "user10@demo" have no dot and must still log in.
export const isValidEmail = (s) => /^[^\s@]+@[^\s@]+$/.test(s || "");

export const canSubmit = ({ email, code }) =>
  isValidEmail(email) && !!String(code || "").trim();
