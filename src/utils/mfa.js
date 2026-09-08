import { ACCESS_TOKEN } from "../enum/storage";
import { saveAccessToken } from "./auth";
import {
  isWebAuthnSupported,
  startRegistration,
  startAuthentication,
  parseAalFromToken,
  WEBAUTHN_PROMPT_DELAY_MS,
} from "./webauthn";

/**
 * ensureAAL2 — the single MFA-enable orchestration (H5, CODE_REVIEW_2026-07-07).
 *
 * ORDER GUARANTEE (the SettingModal exemplar, now the only implementation):
 * WebAuthn must SUCCEED first; only then is `mfa_enabled: true` persisted.
 * The reversed order (persist first, then prompt) let a cancelled Touch ID
 * leave the account in `mfa_enabled=true` + AAL1-token limbo — every
 * subsequent `require_aal2` call re-popped the enable dialog (self-lock).
 *
 * `ops` is an adapter so this stays import-cycle-free (service/request.js
 * cannot import the axios-wrapped ../api). Every op resolves to UNWRAPPED
 * response data:
 *   registerOptions(): Promise<options>
 *   registerVerify(credential): Promise<{access_token?}>
 *   upgradeOptions(): Promise<options>
 *   upgradeVerify(assertion): Promise<{access_token?}>
 *   updateSettings(patch): Promise<any>
 *   getSettings?(): Promise<{security?: {webauthn_registered?}}>
 *                   (only needed when `webauthnRegistered` isn't passed)
 *
 * @param {object} p
 * @param {object} p.ops adapter above
 * @param {boolean} [p.webauthnRegistered] pass when the caller already knows,
 *        to skip the extra getSettings round-trip
 * @returns {Promise<{upgraded: boolean, registeredNow: boolean}>}
 *          upgraded: a WebAuthn ceremony ran and the session is now AAL2;
 *          registeredNow: that ceremony was a first-time credential creation
 * @throws NotAllowedError (user cancelled), Error("WebAuthn not supported…"),
 *         or the failing API error — in every throw path NOTHING has been
 *         persisted beyond what already held before the call.
 */
export async function ensureAAL2({ ops, webauthnRegistered }) {
  // Already AAL2 — no ceremony needed, but still persist the flag: every
  // caller's intent is "enable MFA". There used to be a
  // `persistWhenAlreadyAal2=false` mode for gates that only needed the AAL2
  // session (the HIE connect flow); that flow is gone and no caller ever
  // passed false, so the branch was unreachable.
  if (parseAalFromToken(localStorage.getItem(ACCESS_TOKEN)) >= 2) {
    await ops.updateSettings({ mfa_enabled: true });
    return { upgraded: false, registeredNow: false };
  }

  if (!isWebAuthnSupported()) {
    throw new Error("WebAuthn not supported on this device");
  }

  let registered = webauthnRegistered;
  if (registered === undefined) {
    if (!ops.getSettings) {
      throw new Error(
        "ensureAAL2: pass webauthnRegistered or provide ops.getSettings",
      );
    }
    const settings = await ops.getSettings();
    registered = !!settings?.security?.webauthn_registered;
  }

  // Yield briefly so the invoking UI (Switch toggle / confirm Modal) finishes
  // animating before the native WebAuthn prompt appears (see
  // WEBAUTHN_PROMPT_DELAY_MS doc for the browser rationale).
  await new Promise((r) => setTimeout(r, WEBAUTHN_PROMPT_DELAY_MS));

  let res;
  if (!registered) {
    // First-time credential creation — registration verify returns AAL2 token.
    const options = await ops.registerOptions();
    const credential = await startRegistration(options);
    res = await ops.registerVerify(credential);
  } else {
    // Has credential, session is AAL1 — step-up ceremony.
    const options = await ops.upgradeOptions();
    const assertion = await startAuthentication(options);
    res = await ops.upgradeVerify(assertion);
  }
  if (res?.access_token) {
    saveAccessToken(res.access_token);
  }

  // Only now — the session is verifiably AAL2 — persist the flag.
  await ops.updateSettings({ mfa_enabled: true });

  return { upgraded: true, registeredNow: !registered };
}
