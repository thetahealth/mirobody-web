// Initialize Sentry first (side effect import)
import "./utils/sentry.js";
import { createBrowserRouter, isSentryEnabled } from "./utils/sentry.js";
import DraggableFeedbackButton from "./components/DraggableFeedbackButton";
import FileViewOverlay from "./components/FileViewOverlay";
// import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
// Self-hosted variable fonts — load before app CSS so nothing renders in a
// fallback face first.
import "@fontsource-variable/source-sans-3/index.css";
import "@fontsource-variable/fraunces/full.css";
import "@fontsource-variable/geist-mono/index.css";
import "./index.css";
import { routes } from "./router/index.jsx";
import { initializeI18n } from "./utils/i18n.js";
import device from "current-device";
import { notification, message, ConfigProvider } from "antd";
import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import i18nextInstance from "i18next";
import { NotificationContext } from "./context/index.js";
import zhCN from "antd/locale/zh_CN";
import zhTW from "antd/locale/zh_TW";
import jaJP from "antd/locale/ja_JP";
import enUS from "antd/locale/en_US";
import ruRU from "antd/locale/ru_RU";
import { LANGUAGE_CODE } from "./enum/lang.js";
import "dayjs/locale/zh-cn";
import "dayjs/locale/zh-tw";
import "dayjs/locale/ja";
import "dayjs/locale/ru";
import dayjs from "dayjs";
import timezone from "dayjs/plugin/timezone";
import utc from "dayjs/plugin/utc";
import { enableMapSet } from "immer";
import { adoptSharedSession } from "./utils/auth.js";
import { antdTheme } from "./theme.js";
import usePrefersDark from "./hooks/usePrefersDark.js";

// Adopt a shared cross-subdomain session (mb_at cookie) BEFORE the router/guards
// run, so arriving from / returning from the cdm API platform is seamless both
// ways (no spurious re-login). No-op when we already have a native session.
adoptSharedSession();

// Create router after Sentry initialization
const router = createBrowserRouter(routes);

// Show feedback button in non-production environments when Sentry is enabled
const showFeedbackButton =
  isSentryEnabled && !(import.meta.env.VITE_ENV || "").includes("prod");

enableMapSet();

dayjs.extend(utc);
dayjs.extend(timezone);

/* initialize i18n */
initializeI18n();

// English for anything unmatched, the same as i18next's fallbackLng: a page
// whose copy fell back to English must not print its dates and antd
// widgets in another language.
const syncDayjsLocale = (language) => {
  const locale = {
    [LANGUAGE_CODE.EN]: "en",
    [LANGUAGE_CODE.RU]: "ru",
    [LANGUAGE_CODE.ZH_CN]: "zh-cn",
    [LANGUAGE_CODE.ZH_TW]: "zh-tw",
    [LANGUAGE_CODE.JA]: "ja",
  }[language] || "en";
  dayjs.locale(locale);
};
syncDayjsLocale(i18nextInstance.resolvedLanguage || i18nextInstance.language);
i18nextInstance.on("languageChanged", syncDayjsLocale);

/* initialize eruda - dynamic import to avoid bundling in production */
if (
  (import.meta.env.VITE_ENV || "").includes("test") &&
  (device.mobile() || device.tablet())
) {
  import("eruda").then((eruda) => eruda.default.init());
}
export default function App() {
  const [api, contextHolder] = notification.useNotification();
  const [messageApi, messageContextHolder] = message.useMessage();
  const { i18n } = useTranslation();
  const dark = usePrefersDark();
  const theme = useMemo(() => antdTheme(dark), [dark]);

  const _notificationApi = useMemo(() => api, [api]);
  const _messageApi = useMemo(() => messageApi, [messageApi]);

  const locale = useMemo(() => {
    return {
      [LANGUAGE_CODE.EN]: enUS,
      [LANGUAGE_CODE.RU]: ruRU,
      [LANGUAGE_CODE.ZH_CN]: zhCN,
      [LANGUAGE_CODE.ZH_TW]: zhTW,
      [LANGUAGE_CODE.JA]: jaJP,
    }[i18n.resolvedLanguage || i18n.language] || enUS;
  }, [i18n.language, i18n.resolvedLanguage]);

  return (
    <ConfigProvider locale={locale} theme={theme}>
      <NotificationContext.Provider
        value={{ notificationApi: _notificationApi, messageApi: _messageApi }}
      >
        {contextHolder}
        {messageContextHolder}
        <RouterProvider router={router} />
        <FileViewOverlay />
        {showFeedbackButton && <DraggableFeedbackButton />}
      </NotificationContext.Provider>
    </ConfigProvider>
  );
}

createRoot(document.getElementById("root")).render(
  // <StrictMode>
  <App />,
  // </StrictMode>,
);
