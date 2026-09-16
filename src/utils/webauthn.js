/**
 * WebAuthn browser API wrapper for AAL2 multi-factor authentication.
 */

/**
 * Short delay (ms) to wait before invoking `navigator.credentials.create/get()`
 * after a UI affordance (Switch toggle, Modal confirm) is dismissed.
 *
 * Why: on some browsers (notably Safari/macOS) calling the WebAuthn API while
 * the preceding UI is still animating/closing causes the native prompt to
 * misalign or the user-activation gesture to be considered stale, resulting
 * in a NotAllowedError. A small yield lets the component finish unmounting
 * and the focus to settle before the OS dialog appears.
 *
 * If/when we confirm browsers no longer need this, drop it here in one place.
 */
export const WEBAUTHN_PROMPT_DELAY_MS = 300;

/**
 * Check if WebAuthn is supported in the current browser.
 */
export const isWebAuthnSupported = () => {
  return (
    window.PublicKeyCredential !== undefined &&
    typeof window.PublicKeyCredential === "function"
  );
};

/**
 * Decode a base64url string to Uint8Array.
 */
const base64urlToBytes = (base64url) => {
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
};

/**
 * Encode Uint8Array/ArrayBuffer to base64url string.
 */
const bytesToBase64url = (buffer) => {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

/**
 * Convert server registration options to the format expected by navigator.credentials.create().
 */
const prepareRegistrationOptions = (options) => {
  const publicKey = {
    ...options,
    challenge: base64urlToBytes(options.challenge),
    user: {
      ...options.user,
      id: base64urlToBytes(options.user.id),
    },
  };

  if (options.excludeCredentials) {
    publicKey.excludeCredentials = options.excludeCredentials.map((cred) => ({
      ...cred,
      id: base64urlToBytes(cred.id),
    }));
  }

  return { publicKey };
};

/**
 * Convert server authentication options to the format expected by navigator.credentials.get().
 */
const prepareAuthenticationOptions = (options) => {
  const publicKey = {
    ...options,
    challenge: base64urlToBytes(options.challenge),
  };

  if (options.allowCredentials) {
    publicKey.allowCredentials = options.allowCredentials.map((cred) => ({
      ...cred,
      id: base64urlToBytes(cred.id),
    }));
  }

  return { publicKey };
};

/**
 * Serialize a registration credential response for sending to the server.
 */
const serializeRegistrationCredential = (credential) => {
  const response = credential.response;
  return {
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    response: {
      attestationObject: bytesToBase64url(response.attestationObject),
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
      transports: response.getTransports ? response.getTransports() : [],
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  };
};

/**
 * Serialize an authentication credential response for sending to the server.
 */
const serializeAuthenticationCredential = (credential) => {
  const response = credential.response;
  return {
    id: credential.id,
    rawId: bytesToBase64url(credential.rawId),
    type: credential.type,
    response: {
      authenticatorData: bytesToBase64url(response.authenticatorData),
      clientDataJSON: bytesToBase64url(response.clientDataJSON),
      signature: bytesToBase64url(response.signature),
      userHandle: response.userHandle
        ? bytesToBase64url(response.userHandle)
        : null,
    },
    clientExtensionResults: credential.getClientExtensionResults(),
    authenticatorAttachment: credential.authenticatorAttachment,
  };
};

/**
 * Start WebAuthn registration (create a new credential).
 * @param {Object} serverOptions - Options from /auth/webauthn/register/options
 * @returns {Object} Serialized credential ready to send to server
 */
export const startRegistration = async (serverOptions) => {
  const createOptions = prepareRegistrationOptions(serverOptions);
  const credential = await navigator.credentials.create(createOptions);
  return serializeRegistrationCredential(credential);
};

/**
 * Start WebAuthn authentication (use an existing credential).
 * @param {Object} serverOptions - Options from /auth/webauthn/login/options
 * @returns {Object} Serialized credential ready to send to server
 */
export const startAuthentication = async (serverOptions) => {
  const getOptions = prepareAuthenticationOptions(serverOptions);
  const credential = await navigator.credentials.get(getOptions);
  return serializeAuthenticationCredential(credential);
};

/**
 * Decode a JWT payload (the middle segment) into an object.
 * Returns null if the token is missing/malformed.
 *
 * Note: this is decode-only — it does NOT verify the signature. Use only
 * for reading non-sensitive claims (aal, exp, session_start) on the client.
 */
export const decodeJwtPayload = (token) => {
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded.replace(/-/g, "+").replace(/_/g, "/")));
  } catch {
    return null;
  }
};

/**
 * Parse AAL level from a JWT token string.
 * Returns the aal claim value (1 or 2), defaults to 0 if not present.
 */
export const parseAalFromToken = (token) => {
  return decodeJwtPayload(token)?.aal || 0;
};

/**
 * Identity claims the access token carries: `email` and `sub` (the user id).
 *
 * This is the only client-side source for the signed-in address —
 * `/api/beneficiary-users` returns id / name / nickname / gender / blood_type /
 * age and no email at all, and the auth response is just the token pair. So the
 * account row and the profile page read it from here.
 */
export const parseIdentityFromToken = (token) => {
  const payload = decodeJwtPayload(token);
  return {
    email: payload?.email || "",
    user_id: payload?.sub ? String(payload.sub) : "",
  };
};
