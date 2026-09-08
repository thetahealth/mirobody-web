import { mcpRequestInstance } from "../service/request.js";

/*
 * Google Verify
 */
export const googleVerify = (data) => {
  return mcpRequestInstance.post("/google/verify", data);
};

/**
 * Apple Verify
 */

export const appleVerify = (data) => {
  return mcpRequestInstance.post("/apple/verify", data);
};

/**
 * Email Login
 */

export const emailLogin = (data) => {
  return mcpRequestInstance.post("/email/login", data);
};

/**
 * Email Verify
 */

export const emailVerify = (data) => {
  return mcpRequestInstance.post("/email/verify", data);
};

/**
 * Password login / registration.
 *
 * The code routes above need a mail provider; a self-hosted deployment usually
 * has none, so these are the way in that works out of the box. `register`
 * creates the account and signs you in; it refuses an address that already has
 * a password rather than overwriting it.
 */
export const passwordLogin = (data) => {
  return mcpRequestInstance.post("/password/login", data);
};

export const passwordRegister = (data) => {
  return mcpRequestInstance.post("/password/register", data);
};

/**
 * OAuth2 Authorize
 */
export const oauthAuthorize = (data, access_token) => {
  return mcpRequestInstance.post("/oauth/authorize", data, {
    headers: {
      Authorization: `Bearer ${access_token}`,
    },
  });
};
