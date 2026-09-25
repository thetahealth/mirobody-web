import { Drawer, Tooltip } from "antd";
import { MenuFoldOutlined, MenuUnfoldOutlined } from "@ant-design/icons";
import {
  IconActivity,
  IconDatabase,
  IconMessageCircle,
  IconUser,
  IconUsers,
} from "@tabler/icons-react";
import { useLocation, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import LogoSVG from "../../assets/logo.svg?react";
import LogoMarkSVG from "../../assets/mirobody-icon.svg?react";
import NAV_CONFIG, { NAV_SECTIONS } from "../../config/navConfig.js";
import { useSystemStore } from "../../store/system";
import { useUiStore } from "../../store/ui";
import useIsMobile from "../../hooks/useIsMobile";
import HamburgerButton from "../HamburgerButton";
import AccountMenu from "./AccountMenu";
import RecentChats from "./RecentChats";
import styles from "./index.module.scss";

// Icons live here, not in navConfig: that file is plain data shared with the
// route matching, and it stays serialisable.
const NAV_ICONS = {
  indicators: IconActivity,
  drive: IconDatabase,
  chat: IconMessageCircle,
  profile: IconUser,
  care_circle: IconUsers,
};

function SidebarBody({ collapsed = false }) {
  const { t } = useTranslation();
  // Inside the mobile drawer the drawer IS the panel, so the rail toggle has
  // nothing to act on — it would set the preference and change nothing on
  // screen. Hidden there rather than left as a control that does nothing.
  const isMobile = useIsMobile();
  const location = useLocation();
  const navigate = useNavigate();
  const systemState = useSystemStore();
  const setSidebarDrawerOpen = useUiStore((s) => s.setSidebarDrawerOpen);
  const toggleCollapsed = useUiStore((s) => s.toggleSidebarCollapsed);

  // Hide nav items whose `flagKey` resolves to a falsy system-store flag
  // (e.g. the Developer console is hidden unless isShowDeveloper is true).
  const navItems = NAV_CONFIG.filter(
    (item) => !item.flagKey || systemState[item.flagKey],
  );

  const isActive = (matchPaths) =>
    matchPaths.some((path) =>
      path === "/"
        ? location.pathname === "/"
        : location.pathname.startsWith(path),
    );

  const goNav = (item) => {
    setSidebarDrawerOpen(false);
    // External entries (e.g. the developer / API platform app) leave the SPA.
    if (item.externalUrl) {
      window.location.assign(item.externalUrl);
      return;
    }
    navigate(item.path);
  };

  const onChat = isActive(["/ask", "/chat"]);

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ""}`}>
      <div className={styles.brand}>
        {/* The wordmark is 154px wide and the rail is 64: collapsed shows the
            square mark instead of scaling the logo down to illegible. */}
        {collapsed ? <LogoMarkSVG /> : <LogoSVG />}
        {!isMobile && (
          <button
            type="button"
            className={styles.collapse_btn}
            aria-label={collapsed ? t("sidebar_expand") : t("sidebar_collapse")}
            aria-expanded={!collapsed}
            title={collapsed ? t("sidebar_expand") : t("sidebar_collapse")}
            onClick={toggleCollapsed}
          >
            {collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          </button>
        )}
      </div>

      {NAV_SECTIONS.map((section) => {
        const items = navItems.filter((i) => i.section === section.key);
        if (items.length === 0) return null;
        return (
          <div key={section.key} className={styles.section}>
            {/* The group label has no room on the rail; the rule between the
                groups survives (see the scss) so the split is still legible. */}
            {!collapsed && (
              <div className={styles.section_label}>{t(section.i18nKey)}</div>
            )}
            {items.map((item) => {
              const Icon = NAV_ICONS[item.key];
              const active = isActive(item.matchPaths);
              const label = t(item.i18nKey);
              const button = (
                <button
                  type="button"
                  key={item.key}
                  className={`${styles.nav_item} ${
                    active ? styles.nav_item_active : ""
                  }`}
                  aria-current={active ? "page" : undefined}
                  aria-label={collapsed ? label : undefined}
                  data-tour={item.tour}
                  onClick={() => goNav(item)}
                >
                  {Icon && <Icon className={styles.nav_icon} size={16} stroke={1.6} />}
                  {!collapsed && <span>{label}</span>}
                </button>
              );
              // A bare glyph with no way to find out what it is was the exact
              // failing of the rail this sidebar replaced. Collapsed, every
              // icon names itself on hover and carries an accessible name.
              return collapsed ? (
                <Tooltip key={item.key} title={label} placement="right">
                  {button}
                </Tooltip>
              ) : (
                button
              );
            })}
          </div>
        );
      })}

      {/* Conversation history hangs under the nav on the chat page only — it is
          that page's working list, not a permanent part of the map. The care
          circle used to sit here too; it is a page of its own now (管理 ›
          关爱圈), because a roster of people is a place you go, not a filter. */}
      {onChat && !collapsed && (
        <div className={styles.context}>
          <RecentChats />
        </div>
      )}

      <AccountMenu collapsed={collapsed} />
    </aside>
  );
}

/**
 * Phone-only strip carrying the drawer trigger and the wordmark. Rendered
 * above the content row by each page, so it must sit outside <Sidebar/> —
 * that one is a column inside the row.
 */
export function MobileTopBar() {
  const isMobile = useIsMobile();
  const setSidebarDrawerOpen = useUiStore((s) => s.setSidebarDrawerOpen);
  const { t } = useTranslation();

  if (!isMobile) return null;

  return (
    <div className={styles.topbar}>
      <HamburgerButton
        ariaLabel={t("sidebar_workspace")}
        onClick={() => setSidebarDrawerOpen(true)}
      />
      <LogoSVG />
    </div>
  );
}

/**
 * Desktop: a permanent 240px column. Phone: the same column inside a left
 * drawer, opened from MobileTopBar (or from a page header that wants to point
 * at the member list / history it holds).
 */
function Sidebar() {
  const isMobile = useIsMobile();
  const sidebarDrawerOpen = useUiStore((s) => s.sidebarDrawerOpen);
  const setSidebarDrawerOpen = useUiStore((s) => s.setSidebarDrawerOpen);
  const collapsed = useUiStore((s) => s.sidebarCollapsed);

  if (!isMobile) return <SidebarBody collapsed={collapsed} />;

  return (
    <Drawer
      placement="left"
      open={sidebarDrawerOpen}
      onClose={() => setSidebarDrawerOpen(false)}
      width={Math.min(300, Math.round(window.innerWidth * 0.85))}
      // The drawer is the sidebar, so its chrome has to disappear into it: the
      // default header is a white band above the brand, in a different colour
      // to the column underneath it.
      styles={{
        body: { padding: 0 },
        header: {
          padding: "8px 12px",
          border: "none",
          backgroundColor: "var(--color-bg-soft)",
        },
      }}
      // Mount the sidebar (and run its data-fetching effects) on page load, not
      // first open — page headers read the data it fetches.
      forceRender
    >
      <SidebarBody />
    </Drawer>
  );
}

export default Sidebar;
