import { mcpRequestInstance } from "../service/request.js";

/**
 * Get WebAuthn registration options (requires JWT auth).
 */
export const registerOptions = () => {
  return mcpRequestInstance.post("/auth/webauthn/register/options");
};

/**
 * Verify WebAuthn registration (requires JWT auth).
 */
export const registerVerify = (credential) => {
  return mcpRequestInstance.post("/auth/webauthn/register/verify", {
    credential,
  });
};

/**
 * Get WebAuthn authentication options (requires mfa_ticket).
 */
export const loginOptions = (mfaTicket) => {
  return mcpRequestInstance.post("/auth/webauthn/login/options", {
    mfa_ticket: mfaTicket,
  });
};

/**
 * Verify WebAuthn authentication and get AAL2 token (requires mfa_ticket).
 */
export const loginVerify = (mfaTicket, credential) => {
  return mcpRequestInstance.post("/auth/webauthn/login/verify", {
    mfa_ticket: mfaTicket,
    credential,
  });
};

/**
 * Get WebAuthn options for in-session AAL upgrade (requires JWT).
 */
export const upgradeOptions = () => {
  return mcpRequestInstance.post("/auth/webauthn/upgrade/options");
};

/**
 * Verify WebAuthn and get AAL2 token for session upgrade (requires JWT).
 */
export const upgradeVerify = (credential) => {
  return mcpRequestInstance.post("/auth/webauthn/upgrade/verify", {
    credential,
  });
};
