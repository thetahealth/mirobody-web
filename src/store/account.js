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
import { parseAalFromToken } from "../utils/webauthn";
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

  setUserInfo: (userInfo) => {
    localStorage.setItem(USER_NAME, userInfo.name || "");
    localStorage.setItem(USER_EMAIL, userInfo.email || "");
    localStorage.setItem(USER_ID, userInfo.user_id || "");
    set({
      user_name: userInfo.name || "",
      user_email: userInfo.email || "",
      user_id: userInfo.user_id || "",
    });
    // Sync current_drive_user_id when user info is updated
    useDriveStore.getState().setCurrentDriveUserId(userInfo.user_id || "");
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
        const sent = await api.listSharedByMe(signal);
        managed = (sent || [])
          .filter((i) => i.status === "authorized" && i.query_user_id)
          .map((i) => ({
            id: i.query_user_id,
            name: i.nickname || "",
            nickname: i.nickname,
            // Hide the synthetic email we mint for virtual members; keep real
            // ones (people you actually shared to).
            email: i.email?.endsWith("@virtual.mirobody.ai") ? "" : i.email,
            share_id: i.share_id,
            is_current_user: false,
            is_managed: true,
          }));
      } catch (mErr) {
        if (mErr?.name !== "AbortError" && mErr?.name !== "CanceledError") {
          consola.error("ERROR: listSharedByMe", mErr);
        }
      }

      const seen = new Set(res.map((u) => String(u.id)));
      const merged = [...res];
      for (const m of managed) {
        if (!seen.has(String(m.id))) {
          merged.push(m);
          seen.add(String(m.id));
        }
      }

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
