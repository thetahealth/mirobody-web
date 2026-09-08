const NAV_CONFIG = [
  {
    key: "drive",
    path: "/data",
    matchPaths: ["/", "/data", "/drive"],
    i18nKey: "drive",
  },
  {
    key: "chat",
    path: "/ask",
    matchPaths: ["/ask", "/chat"],
    i18nKey: "chat",
  },
  // Note: the developer / API platform (cdm) deliberately is NOT a top-nav item
  // — it lives in the Settings modal as a highlighted "Developer Platform" card
  // (see components/Modal/SettingModal.jsx) so it doesn't compete with the core
  // nav. The /developer route still forwards to cdm (see pages/Developer).
];

export default NAV_CONFIG;
