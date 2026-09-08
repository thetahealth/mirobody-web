import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import device from "current-device";
import { isCnEnvironment } from "../utils";
import { API_BASE_URL } from "../enum/storage";
import api from "../api";
import { consola } from "consola";
import { initializeFirebase } from "../utils/login.js";
import { IS_CDM_ENABLED } from "../config/cdm.js";

export const useSystemStore = create(
  immer((set, get) => ({
    isPC: true,
    isCNEnvironment: false,
    // Read in three places (Settings card, login footer, /developer guard) and
    // never defined until now, so none of them ever rendered. The configured URL
    // is the only thing that decides whether they can work — see config/cdm.js.
    isShowDeveloper: IS_CDM_ENABLED,
    api_base_url: (() => {
      // Initialize from sessionStorage or env
      const userSetting = sessionStorage.getItem(API_BASE_URL);
      if (userSetting && userSetting.trim() !== "") {
        return userSetting.trim();
      }
      return import.meta.env.VITE_BASE_URL_MCP || "";
    })(),
    setApiBaseUrl: (api_base_url) => {
      set((state) => {
        state.api_base_url = api_base_url;
      });
    },
    // login — driven entirely by what the deployment configured, reported in
    // /mirobody.json.
    isShowGoogleLogin: false,
    isShowAppleLogin: false,
    // webauthn / mfa
    isShowWebAuthn: false,
    // Device providers. Default ON: a missing flag read as "off" and this whole
    // surface never rendered for any self-hoster. It degrades to an empty state
    // when nothing is installed, so showing it costs nothing.
    isShowMobileSource: true,
    // api config
    isShowAPIConfig: true,
    initMirobodyConfig: async () => {
      try {
        const data = await api.getMirobodyConfig();
        set((state) => {
          state.isShowAPIConfig = !!data.__IS_API_CONFIG_ON__;
          state.isShowWebAuthn = !!data.__IS_WEBAUTHN_ON__;
          // Absent key ≠ off (see above): only an explicit false hides it.
          if (data.__IS_MOBILE_SOURCE_ON__ !== undefined) {
            state.isShowMobileSource = !!data.__IS_MOBILE_SOURCE_ON__;
          }
        });
        // Only offer the Google/Apple buttons once Firebase actually
        // initialised — otherwise the button leads nowhere.
        const { firebaseApp } = initializeFirebase(data);
        if (firebaseApp) {
          set((state) => {
            state.isShowGoogleLogin = !!data.__IS_GOOGLE_LOGIN_ON__;
            state.isShowAppleLogin = !!data.__IS_APPLE_LOGIN_ON__;
          });
        }
      } catch (error) {
        consola.error("ERROR: Init Mirobody Config", error);
      }
    },
    /* init */
    initializeSystem: async () => {
      const { initMirobodyConfig } = get();
      const isPC = device.desktop();
      const isCNEnvironment = isCnEnvironment();

      set((state) => {
        state.isPC = isPC;
        state.isCNEnvironment = isCNEnvironment;
      });
      initMirobodyConfig();
    },
  })),
);
