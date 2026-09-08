// Pure helpers for the password form. Framework-free so they unit-test under the
// repo's node-env vitest setup, like `emailOtp.js` beside them.

import { isValidEmail } from "./emailOtp";

// Must match `UserService._MIN_PASSWORD_LEN`. Checking here too is not a
// duplicate of the server rule — it is what turns "the request failed" into
// "your password is too short" before a round trip.
export const MIN_PASSWORD_LENGTH = 8;

export const isValidPassword = (s) =>
  String(s || "").length >= MIN_PASSWORD_LENGTH;

export const canSubmitPassword = ({ email, password }) =>
  isValidEmail(email) && isValidPassword(password);
