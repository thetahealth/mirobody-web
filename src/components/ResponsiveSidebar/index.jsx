import { Drawer } from "antd";
import useIsMobile from "../../hooks/useIsMobile";
import { useUiStore } from "../../store/ui";

/**
 * Page-level sidebar wrapper.
 * - Desktop: renders children inline (current flex-column sidebar behaviour).
 * - Mobile (≤768px): renders children inside a left Drawer; open state comes
 *   from the ui store so a trigger button anywhere (e.g. page header) can
 *   toggle it. Callers close it after navigation via setSidebarDrawerOpen(false).
 */
function ResponsiveSidebar({ children, drawerWidth = 300 }) {
  const isMobile = useIsMobile();
  const sidebarDrawerOpen = useUiStore((s) => s.sidebarDrawerOpen);
  const setSidebarDrawerOpen = useUiStore((s) => s.setSidebarDrawerOpen);

  if (!isMobile) return children;

  return (
    <Drawer
      placement="left"
      open={sidebarDrawerOpen}
      onClose={() => setSidebarDrawerOpen(false)}
      width={Math.min(drawerWidth, Math.round(window.innerWidth * 0.85))}
      styles={{ body: { padding: 0 } }}
      rootClassName="mobile-sidebar-drawer"
      // Mount the sidebar (and run its data-fetching effects) on page load, not
      // first open — the page's trigger (e.g. DriveHeader) can depend on that data.
      forceRender
    >
      {children}
    </Drawer>
  );
}

export default ResponsiveSidebar;
