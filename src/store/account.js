import { create } from "zustand";
import {
  ACCESS_TOKEN,
  CURRENT_QUERY_USER_ID,
  CURRENT_QUERY_USER_NAME,
  USER_EMAIL,
  USER_ID,
  USER_NAME,
} from "../enum/storage";
import api from "../api";
import { useDriveStore } from "./Drive";
import { parseAalFromToken, parseIdentityFromToken } from "../utils/webauthn";
import consola from "consola";

export const useAccountStore = create((set, get) => ({
  // Internal state: AbortController for beneficiary users request
  _beneficiaryUsersController: null,

  // login user info
  user_id: localStorage.getItem(USER_ID) || "",
  user_email: localStorage.getItem(USER_EMAIL) || "",
  user_name: localStorage.getItem(USER_NAME) || "",
  currentAAL: parseAalFromToken(localStorage.getItem(ACCESS_TOKEN)),

  updateAAL: (token) => {
    set({ currentAAL: parseAalFromToken(token) });
  },

  // Called from useAuth.saveAuthData with the AUTH RESPONSE, which carries only
  // the token pair — no name, email or user_id. Passing it straight through
  // wrote three empty strings and blanked whatever was already known, which is
  // why the account row showed no address after a real sign-in. The token
  // itself carries `email` and `sub`, so read them from there and let an
  // explicit field in the payload win if a future response ever has one.
  setUserInfo: (userInfo) => {
    const fromToken = parseIdentityFromToken(userInfo?.access_token);
    const name = userInfo.name || get().user_name || "";
    const email = userInfo.email || fromToken.email;
    const user_id = userInfo.user_id || fromToken.user_id;

    localStorage.setItem(USER_NAME, name);
    localStorage.setItem(USER_EMAIL, email);
    localStorage.setItem(USER_ID, user_id);
    set({ user_name: name, user_email: email, user_id });
    // Sync current_drive_user_id when user info is updated
    if (user_id) useDriveStore.getState().setCurrentDriveUserId(user_id);
  },

  // beneficiary users info
  beneficiary_users: [
    // me
    {
      id: localStorage.getItem(USER_ID) || "",
      name: localStorage.getItem(USER_NAME) || "",
      email: localStorage.getItem(USER_EMAIL) || "",
      is_current_user: true,
    },
  ],
  setBeneficiaryUsers: (users) => {
    set({
      beneficiary_users: users,
    });
  },
  /* fetch beneficiary users */
  fetchBeneficiaryUsers: async () => {
    const { _beneficiaryUsersController } = get();

    // Cancel previous request if exists
    if (_beneficiaryUsersController) {
      _beneficiaryUsersController.abort();
    }

    // Create new AbortController for this request
    const newController = new AbortController();
    set({ _beneficiaryUsersController: newController });
    const signal = newController.signal;

    try {
      const res = await api.beneficiaryUsers(signal);

      // `/api/beneficiary-users` only returns people who shared with ME. Members
      // I created/manage (owner→member) live in `/invitation/shared-by-me/list`;
      // merge them in (best-effort) so they're selectable in "query for"/Drive.
      // These carry share_id + is_managed so the UI can offer a remove action.
      let managed = [];
      try {
        // `{members: [...]}`, not a bare array — the envelope's `data` is an
        // object, which is why this route used to fail every call.
        const sent = await api.listSharedByMe(signal);
        // The list covers every circle I belong to. Only the ones I own are
        // people I manage: someone who took over their account is in the
        // circle of the person who added them, who is not theirs to remove.
        const myId = String(res.find((u) => u.is_current_user)?.id ?? "");
        managed = (sent?.members || [])
          .filter(
            (i) =>
              i.status === "authorized" &&
              i.query_user_id &&
              String(i.owner_user_id) === myId,
          )
          .map((i) => ({
            id: i.query_user_id,
            name: i.nickname || i.name || "",
            nickname: i.nickname,
            // A virtual member's address is a placeholder: the server blanks
            // it and says `managed`. The suffix check covers older servers.
            email:
              i.managed || i.email?.endsWith("@virtual.mirobody.ai") ? "" : i.email,
            share_id: i.share_id,
            is_current_user: false,
            is_managed: true,
            // Only the person who added a virtual member may send them the
            // link that gives them their own login.
            can_invite_to_sign_in: Boolean(i.can_invite_to_sign_in),
            // A member may keep their record to themselves (health_access 0).
            // They stay removable here, but there is nothing to view as them.
            can_view: Number(i.health_access) >= 1,
          }));
      } catch (mErr) {
        if (mErr?.name !== "AbortError" && mErr?.name !== "CanceledError") {
          consola.error("ERROR: listSharedByMe", mErr);
        }
      }

      // A virtual member is on BOTH lists (she shares with me read-write), and
      // the roster copy lacks share_id / is_managed. Dropping the second copy
      // lost them, so the remove and invite actions never showed; the managed
      // fields are laid over the roster entry instead.
      const byId = new Map(managed.map((m) => [String(m.id), m]));
      const merged = res.map((u) => {
        const m = byId.get(String(u.id));
        if (!m) return u;
        byId.delete(String(u.id));
        return {
          ...u,
          email: m.email,
          share_id: m.share_id,
          is_managed: true,
          can_invite_to_sign_in: m.can_invite_to_sign_in,
        };
      });
      merged.push(...byId.values());

      set({
        beneficiary_users: merged,
        _beneficiaryUsersController: null, // Clear controller after successful completion
      });
      const current_user = res.find((user) => user.is_current_user);
      if (current_user) {
        // Initialize user_id if not set
        const { user_id } = get();
        if (!user_id) {
          set({
            user_id: current_user.id,
            user_name: current_user.name,
          });
          localStorage.setItem(USER_ID, current_user.id || "");
          localStorage.setItem(USER_NAME, current_user.name || "");
        } else if (current_user.name && current_user.name !== get().user_name) {
          // The roster is authoritative for the display name; the email stays
          // whatever the token gave us (this endpoint has no email field).
          set({ user_name: current_user.name });
          localStorage.setItem(USER_NAME, current_user.name);
        }
        // Initialize current_drive_user_id if not set
        const { current_drive_user_id } = useDriveStore.getState();
        if (!current_drive_user_id) {
          useDriveStore.getState().setCurrentDriveUserId(current_user.id);
        }
      }
      return merged;
    } catch (error) {
      // Ignore abort errors, don't update state
      if (error.name === "AbortError" || error.name === "CanceledError") {
        return;
      }
      consola.error("ERROR: fetchBeneficiaryUsers", error);
    }
  },

  // current user - query for
  current_query_user_id:
    localStorage.getItem(CURRENT_QUERY_USER_ID) ||
    localStorage.getItem(USER_ID) ||
    "",
  current_query_user_name:
    localStorage.getItem(CURRENT_QUERY_USER_NAME) ||
    localStorage.getItem(USER_NAME) ||
    "",
  setCurrentQueryUser: ({ user_id, user_name }) => {
    localStorage.setItem(CURRENT_QUERY_USER_ID, user_id || "");
    localStorage.setItem(CURRENT_QUERY_USER_NAME, user_name || "");
    set({
      current_query_user_id: user_id || "",
      current_query_user_name: user_name || "",
    });
  },
  setCurrentQueryUserByUserId: (user_id) => {
    if (!user_id) return;
    const { beneficiary_users } = get();
    const user = beneficiary_users.find((user) => user.id === user_id);
    if (user) {
      set({
        current_query_user_id: user.id || "",
        current_query_user_name: user.name || "",
      });
      localStorage.setItem(CURRENT_QUERY_USER_ID, user.id || "");
      localStorage.setItem(CURRENT_QUERY_USER_NAME, user.name || "");
    }
  },
}));
