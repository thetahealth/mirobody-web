/**
 * The sidebar's map of the product, in two groups.
 *
 * `工作区` is where you do the work; `管理` is the records behind it — the same
 * split the Theta surfaces use, so someone who knows one knows the other.
 *
 * Plain data (no JSX) because the route matching reads it too; the icons are
 * mapped by `key` in components/Sidebar.
 *
 * `tour` is the OnboardingTour anchor (see components/OnboardingTour/steps.js).
 * Nothing reads it but the tour, and the tour finds its target with a
 * `[data-tour="…"]` selector rather than a ref threaded down from the layout.
 */
const NAV_CONFIG = [
  // 指标 first: the standardized readings are what people come for. They were
  // a tab on /data, sharing a page with the two things that PRODUCE them —
  // uploaded files and connected devices — so the output sat at the same level
  // as its own plumbing.
  {
    key: "indicators",
    section: "workspace",
    path: "/indicators",
    matchPaths: ["/", "/indicators"],
    i18nKey: "indicators_tab",
    tour: "sidebar-indicators",
  },
  {
    key: "drive",
    section: "workspace",
    path: "/data",
    matchPaths: ["/data", "/drive"],
    i18nKey: "drive",
    tour: "sidebar-data",
  },
  {
    key: "chat",
    section: "workspace",
    path: "/ask",
    matchPaths: ["/ask", "/chat"],
    i18nKey: "chat",
    tour: "sidebar-chat",
  },
  // 档案 and 关爱圈 are two different things and are listed as two: one is your
  // own record, the other is the people you share with. They were briefly a
  // single "care circle" list nested under the workspace nav, which left the
  // signed-in user's own record with nowhere to live.
  {
    key: "profile",
    section: "management",
    path: "/profile",
    matchPaths: ["/profile"],
    i18nKey: "profile",
    tour: "sidebar-profile",
  },
  {
    key: "care_circle",
    section: "management",
    path: "/care-circle",
    matchPaths: ["/care-circle"],
    i18nKey: "care_circle",
    tour: "sidebar-care-circle",
  },
  // Note: the developer / API platform (cdm) deliberately is NOT a nav item —
  // it lives in the Settings modal as a highlighted card so it doesn't compete
  // with the core nav. The /developer route still forwards to cdm.
];

export const NAV_SECTIONS = [
  { key: "workspace", i18nKey: "sidebar_workspace" },
  { key: "management", i18nKey: "sidebar_management" },
];

export default NAV_CONFIG;
