import Modal from "./index.jsx";
import { useTranslation } from "react-i18next";
import i18n from "i18next";
import { LANGUAGE_LIST } from "../../enum/lang.js";
import {
  ACCESS_TOKEN,
  API_BASE_URL,
  CURRENT_QUERY_USER_ID,
  CURRENT_QUERY_USER_NAME,
  LANGUAGE,
  SECURITY_SETTINGS,
  USER_EMAIL,
  USER_ID,
  USER_NAME,
} from "../../enum/storage.js";
import styles from "./SettingModal.module.scss";
import { useSystemStore } from "../../store/system.js";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useNavigate } from "react-router";
import { Button, Select, Switch } from "antd";
import { IconChevronRight, IconCpu, IconServer2 } from "@tabler/icons-react";
import CloseButton from "../CloseButton";
import PersonalMcpLinks from "./PersonalMcpLinks.jsx";
import api from "../../api";
import { CDM_URL } from "../../config/cdm.js";
import { TIMEZONE_LANG_MAP, buildTimezoneSearchMaps } from "../../enum/time.js";
import consola from "consola";
import { clearAuthenticationData, saveAccessToken } from "../../utils/auth.js";
import { writeSharedToken } from "../../utils/sharedSession.js";
import {
  isWebAuthnSupported,
  parseAalFromToken,
  startAuthentication,
  startRegistration,
  WEBAUTHN_PROMPT_DELAY_MS,
} from "../../utils/webauthn.js";

const SettingModal = ({ isOpen, onClose }) => {
  const api_base_url = useSystemStore((state) => state.api_base_url);
  const setApiBaseUrl = useSystemStore((state) => state.setApiBaseUrl);
  const isShowAPIConfig = useSystemStore((state) => state.isShowAPIConfig);
  const isShowWebAuthn = useSystemStore((state) => state.isShowWebAuthn);
  const isShowDeveloper = useSystemStore((state) => state.isShowDeveloper);
  const modelSetup = useSystemStore((state) => state.modelSetup);
  const navigate = useNavigate();

  const [_api_base_url, set_api_base_url] = useState(api_base_url);
  const [api_error, setApiError] = useState("");

  const [currentTimezone, setCurrentTimezone] = useState("");
  const [isLoadingSettings, setIsLoadingSettings] = useState(false);
  const [security, setSecurity] = useState(() => {
    try {
      const cached = localStorage.getItem(SECURITY_SETTINGS);
      return cached ? JSON.parse(cached) : null;
    } catch {
      return null;
    }
  });
  const [isMfaToggling, setIsMfaToggling] = useState(false);
  // Synchronous mutex for MFA toggle. Prevents double-fire from rapid clicks
  // (state updates are async — even with isMfaToggling state set, two clicks
  // arriving within the same render cycle could both pass the guard).
  const mfaTogglingRef = useRef(false);
  const abortControllerRefUserSettings = useRef(null);

  const cleanup = () => {
    if (abortControllerRefUserSettings.current) {
      abortControllerRefUserSettings.current.abort();
      abortControllerRefUserSettings.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen) {
      cleanup();
      return;
    }

    // Reset form state when modal opens
    set_api_base_url(api_base_url);
    setApiError("");

    // Cancel previous requests if exists
    cleanup();

    // Create new AbortController for user settings request
    abortControllerRefUserSettings.current = new AbortController();
    const currentSettingsController = abortControllerRefUserSettings.current;

    setIsLoadingSettings(true);

    // Fetch user settings
    api
      .getUserSettings(currentSettingsController.signal)
      .then((res) => {
        if (!currentSettingsController.signal.aborted) {
          if (res?.preferences?.timezone) {
            setCurrentTimezone(res.preferences.timezone);
          }
          if (res?.security) {
            setSecurity(res.security);
            localStorage.setItem(SECURITY_SETTINGS, JSON.stringify(res.security));
          }
        }
      })
      .catch((error) => {
        if (error.name === "CanceledError" || error.name === "AbortError") {
          return;
        }
        consola.error("ERROR: Get User Settings", error);
      })
      .finally(() => {
        if (!currentSettingsController.signal.aborted) {
          setIsLoadingSettings(false);
        }
      });

    return cleanup;
  }, [isOpen, api_base_url]);

  const { t } = useTranslation();
  const currentLanguage = i18n.language;

  // Get grouped timezone list based on current language
  const timezoneGroupedList = useMemo(() => {
    const list = TIMEZONE_LANG_MAP(currentLanguage);
    return list;
  }, [currentLanguage]);

  // Build timezone search maps for precise filtering
  const { cityNameToTimezones } = useMemo(() => buildTimezoneSearchMaps(), []);

  const handleLanguageChange = (languageCode) => {
    i18n.changeLanguage(languageCode);
    localStorage.setItem(LANGUAGE, languageCode);
  };

  const handleTimezoneChange = async (timezoneCode) => {
    if (timezoneCode === currentTimezone) return;

    // Cancel previous request if exists
    if (abortControllerRefUserSettings.current) {
      abortControllerRefUserSettings.current.abort();
    }

    // Create new AbortController for update request
    abortControllerRefUserSettings.current = new AbortController();
    const currentController = abortControllerRefUserSettings.current;

    setIsLoadingSettings(true);
    try {
      await api.updateUserSettings(
        {
          timezone: timezoneCode,
        },
        currentController.signal,
      );
      if (!currentController.signal.aborted) {
        setCurrentTimezone(timezoneCode);
      }
    } catch (error) {
      if (error.name === "CanceledError" || error.name === "AbortError") {
        return;
      }
      consola.error("ERROR: Update User Settings", error);
    } finally {
      if (!currentController.signal.aborted) {
        setIsLoadingSettings(false);
      }
    }
  };
  const handleMfaToggle = useCallback(async (enabled) => {
    // Synchronous mutex — must check/set BEFORE any await (state setter is async).
    if (mfaTogglingRef.current) return;
    mfaTogglingRef.current = true;
    setIsMfaToggling(true);

    try {
      if (enabled) {
        // Two paths to reach AAL2 before persisting mfa_enabled=true:
        //   1. No credential yet → register (Touch ID, credential + AAL2 token)
        //   2. Has credential but current session is AAL1 → step-up
        //      (Touch ID → upgradeVerify returns AAL2 token)
        //   3. Already AAL2 → skip, backend PUT below is enough
        //
        // Without path 2 the user ends up in an inconsistent state:
        //   mfa_enabled=true (DB) + AAL1 token (local) → next require_aal2
        //   call pops the "Enable Two-Step Verification" dialog from the
        //   403 interceptor even though MFA is already enabled.
        if (!security?.webauthn_registered) {
          if (!isWebAuthnSupported()) {
            consola.error("WebAuthn not supported on this device");
            return;
          }

          // Yield briefly so the Switch animation finishes before the native
          // WebAuthn prompt appears (see WEBAUTHN_PROMPT_DELAY_MS doc).
          await new Promise((r) => setTimeout(r, WEBAUTHN_PROMPT_DELAY_MS));

          const options = await api.registerOptions();
          const credential = await startRegistration(options);
          const res = await api.registerVerify(credential);

          // Registration returns AAL2 token.
          if (res?.access_token) {
            saveAccessToken(res.access_token);
          }

          setSecurity((prev) => ({ ...prev, webauthn_registered: true }));
        } else if (parseAalFromToken(localStorage.getItem(ACCESS_TOKEN)) < 2) {
          // Has credential but still on AAL1 (e.g., just toggled off & on
          // again in the same session). Run a WebAuthn step-up so the
          // resulting session matches the toggle state.
          if (!isWebAuthnSupported()) {
            consola.error("WebAuthn not supported on this device");
            return;
          }

          await new Promise((r) => setTimeout(r, WEBAUTHN_PROMPT_DELAY_MS));

          const options = await api.upgradeOptions();
          const assertion = await startAuthentication(options);
          const res = await api.upgradeVerify(assertion);

          if (res?.access_token) {
            saveAccessToken(res.access_token);
          }
        }
      }

      // Update MFA setting on server.
      const res = await api.updateUserSettings({ mfa_enabled: enabled });
      // When MFA disabled, server returns a new AAL1 token to downgrade session.
      if (!enabled && res?.access_token) {
        saveAccessToken(res.access_token);
      }
      // Persist localStorage based on the freshly computed next state, not
      // a stale closure value (closure may be missing webauthn_registered:true
      // set above).
      setSecurity((prev) => {
        const next = { ...prev, mfa_enabled: enabled };
        localStorage.setItem(SECURITY_SETTINGS, JSON.stringify(next));
        return next;
      });
    } catch (error) {
      if (error.name === "NotAllowedError") {
        consola.warn("WebAuthn cancelled by user (toggle aborted)");
      } else {
        consola.error("ERROR: MFA Toggle", error);
      }
    } finally {
      mfaTogglingRef.current = false;
      setIsMfaToggling(false);
    }
  }, [security]);

  const onClickDeveloper = () => {
    // The two apps share one account system. Re-mirror the current session into
    // the shared-domain cookie right before leaving, so the other app loads
    // already signed in. Needed because `mb_at` is a *session* cookie and may
    // have been dropped on a browser restart even though our localStorage token
    // persists — without this, the other app reads no cookie and looks
    // logged-out.
    const token = localStorage.getItem(ACCESS_TOKEN);
    if (token) writeSharedToken(token);
    onClose?.();
    window.location.assign(CDM_URL);
  };

  const onClickLogout = () => {
    clearAuthenticationData();
    window.location.href = "/login";
  };

  const validateServerUrl = (server_url) => {
    return (
      server_url.trim() !== "" &&
      (server_url.startsWith("http://") || server_url.startsWith("https://")) &&
      !server_url.endsWith("/")
    );
  };

  const handleApiUrlChange = (e) => {
    set_api_base_url(e.target.value);
  };

  const handleApiUrlSave = () => {
    if (!validateServerUrl(_api_base_url)) {
      setApiError(t("please_enter_right_server_url"));
      return;
    }
    setApiBaseUrl(_api_base_url);
    sessionStorage.setItem(API_BASE_URL, _api_base_url);
  };

  const handleApiUrlCancel = () => {
    const VITE_BASE_URL_MCP = import.meta.env.VITE_BASE_URL_MCP;
    set_api_base_url(VITE_BASE_URL_MCP);
    setApiBaseUrl(VITE_BASE_URL_MCP);
    sessionStorage.setItem(API_BASE_URL, VITE_BASE_URL_MCP);
    setApiError("");
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className={styles.settingModal}>
        <h2 className={styles.title}>{t("settings")}</h2>
        <CloseButton onClick={onClose} className="absolute top-[22px] right-[22px]" />
        {/* Developer / API platform (cdm) — a highlighted entry that ties the
            main site to the API platform, tucked in Settings so it stays off
            the core nav. Only shown when the platform is enabled. */}
        {isShowDeveloper && (
          <div className={styles.section}>
            <div
              className={styles.devCard}
              onClick={onClickDeveloper}
              role="button"
              tabIndex={0}
            >
              <div className={styles.devCardIcon}>
                <IconCpu size={20} stroke={1.8} aria-hidden="true" />
              </div>
              <div className={styles.devCardBody}>
                <div className={styles.devCardTitle}>
                  {t("developer_platform_title")}
                </div>
                <div className={styles.devCardDesc}>
                  {t("developer_platform_desc")}
                </div>
              </div>
              <IconChevronRight className={styles.devCardArrow} size={16} stroke={1.8} />
            </div>
          </div>
        )}
        {/* Back to the first-run page, to change the model. Any value means
            the server has that page; it checks the setup token and the
            session itself. */}
        {modelSetup && (
          <div className={styles.section}>
            <div
              className={styles.devCard}
              onClick={() => {
                onClose?.();
                navigate("/setup");
              }}
              role="button"
              tabIndex={0}
            >
              <div className={styles.devCardIcon}>
                <IconServer2 size={20} stroke={1.8} aria-hidden="true" />
              </div>
              <div className={styles.devCardBody}>
                <div className={styles.devCardTitle}>{t("settings_model_title")}</div>
                <div className={styles.devCardDesc}>{t("settings_model_desc")}</div>
              </div>
              <IconChevronRight className={styles.devCardArrow} size={16} stroke={1.8} />
            </div>
          </div>
        )}
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t("language")}</h3>
          <div className={styles.languageList}>
            {LANGUAGE_LIST.map((lang) => (
              <div
                key={lang.code}
                className={`${styles.languageItem} ${
                  currentLanguage === lang.code ? styles.active : ""
                }`}
                onClick={() => handleLanguageChange(lang.code)}
              >
                <div className={styles.radioButton}>
                  {currentLanguage === lang.code && (
                    <div className={styles.radioButtonInner} />
                  )}
                </div>
                <span className={styles.languageName}>{lang.name}</span>
              </div>
            ))}
          </div>
        </div>
        <div className={styles.section}>
          <h3 className={styles.sectionTitle}>{t("timezone")}</h3>
          <Select
            value={currentTimezone}
            onChange={handleTimezoneChange}
            loading={isLoadingSettings}
            placeholder={t("timezone")}
            style={{ width: "100%" }}
            options={timezoneGroupedList}
            showSearch={{
              filterOption: (input, option) => {
                const searchText = input.trim().toLowerCase();
                if (!searchText) return true;

                const value = option?.value || "";
                const label = option?.label || "";
                const labelLower = label.toLowerCase();

                // Check if search text exactly matches a city name in our mapping
                let matchedTimezones =
                  cityNameToTimezones[searchText] ||
                  cityNameToTimezones[input.trim()];

                // If no exact match, check for partial match (e.g., "bei" matches "beijing")
                if (!matchedTimezones || matchedTimezones.length === 0) {
                  // Find all city names that start with the search text
                  const matchingCityNames = Object.keys(
                    cityNameToTimezones,
                  ).filter((cityName) =>
                    cityName.toLowerCase().startsWith(searchText),
                  );

                  if (matchingCityNames.length > 0) {
                    // Collect all timezones from matching city names
                    const allMatchedTimezones = new Set();
                    matchingCityNames.forEach((cityName) => {
                      const tzs = cityNameToTimezones[cityName];
                      if (tzs) {
                        tzs.forEach((tz) => allMatchedTimezones.add(tz));
                      }
                    });
                    matchedTimezones = Array.from(allMatchedTimezones);
                  }
                }

                if (matchedTimezones && matchedTimezones.length > 0) {
                  // Precise match: only show timezones in the matched group
                  return matchedTimezones.includes(value);
                }

                // Fallback: search in label and value for other cases
                // Extract city name from value (e.g., "Shanghai" from "Asia/Shanghai")
                const cityNameFromValue = value.split("/").pop() || "";
                const cityNameLower = cityNameFromValue
                  .toLowerCase()
                  .replace(/_/g, " ");

                return (
                  labelLower.includes(searchText) ||
                  value.toLowerCase().includes(searchText) ||
                  cityNameLower.includes(searchText) ||
                  searchText.includes(cityNameLower)
                );
              },
            }}
            getPopupContainer={() => document.body}
            classNames={{
              popup: {
                root: styles.timezoneSelectDropdown,
              },
            }}
            popupStyle={{ zIndex: 10000 }}
          />
        </div>
        {isShowWebAuthn && (
          <div className={styles.section}>
            <div className="text-[16px] text-[var(--color-text-secondary)] font-[500] mb-2">
              {t("security")}
            </div>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[14px] font-[500]">{t("two_step_verification")}</div>
                <div className="text-[12px] text-[var(--color-text-muted)] mt-1">
                  {t("mfa_enable_desc")}
                </div>
              </div>
              <Switch
                checked={!!security?.mfa_enabled}
                disabled={!security || isMfaToggling}
                loading={isMfaToggling || !security}
                onChange={handleMfaToggle}
              />
            </div>
          </div>
        )}
        {isShowAPIConfig && (
          <div className={styles.section}>
            <div className="flex items-center justify-between">
              <div className="text-[16px] text-[var(--color-text-secondary)] font-[500]">
                {t("api_config")}
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="link"
                  onClick={handleApiUrlSave}
                  style={{ padding: 0 }}
                >
                  {t("save")}
                </Button>
                <Button
                  type="link"
                  onClick={handleApiUrlCancel}
                  style={{ padding: 0 }}
                >
                  {t("reset")}
                </Button>
              </div>
            </div>
            <div className="flex gap-0 items-center">
              <input
                style={{
                  padding: "12px",
                  border: "1px solid",
                  borderColor: api_error ? "var(--color-danger)" : "var(--color-border)",
                }}
                className="flex-1 border border-gray-300 rounded p-2 text-[14px]"
                type="text"
                placeholder={t("api_config_placeholder")}
                value={_api_base_url}
                onChange={handleApiUrlChange}
              />
            </div>
            <div className="text-red-500 text-sm">{api_error && api_error}</div>
          </div>
        )}
        <PersonalMcpLinks />
        <div className={styles.section}>
          <div className={styles.logoutButton} onClick={onClickLogout}>
            {t("logout")}
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SettingModal;
