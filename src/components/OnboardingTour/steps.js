/**
 * The sidebar walkthrough's step list.
 *
 * Targets are found by the `data-tour` attribute the Sidebar and AccountMenu
 * carry (see config/navConfig.js) rather than by refs threaded down from the
 * layout: the sidebar is on every signed-in page, so an attribute selector
 * keeps the walkthrough entirely out of those components' logic.
 *
 * It anchors ONLY the sidebar and never navigates. A tour that changes route
 * on every step has to wait for a lazy chunk to mount before it can point at
 * anything, and the sidebar is already the map of the product — naming each
 * entrance is the whole job.
 *
 * `anchor` is the data-tour value. A step whose anchor is not in the DOM is
 * dropped when the tour opens (see store/tour.js), because antd renders an
 * anchorless step as a centred card — a paragraph about a thing the reader
 * cannot see is worse than not mentioning it.
 */
export const TOUR_STEPS = [
  // No anchor on the first step: antd renders it as a centred welcome card.
  { key: "welcome" },
  // Sidebar order (config/navConfig.js): the tour walks the list top to bottom.
  { key: "data", anchor: "sidebar-data" },
  { key: "indicators", anchor: "sidebar-indicators" },
  { key: "chat", anchor: "sidebar-chat" },
  { key: "profile", anchor: "sidebar-profile" },
  { key: "care_circle", anchor: "sidebar-care-circle" },
  { key: "account", anchor: "sidebar-account" },
];

export const anchorSelector = (anchor) => `[data-tour="${anchor}"]`;
