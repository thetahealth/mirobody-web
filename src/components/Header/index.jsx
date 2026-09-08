import { useState } from "react";
import { Drawer } from "antd";
import styles from "./index.module.scss";
import LogoSVG from "../../assets/logo.svg?react";
import LogoShortSVG from "../../assets/mirobody-logo-short.svg?react";
import { useTranslation } from "react-i18next";
import SettingsSVG from "../../assets/settings.svg?react";
import SettingModal from "../Modal/SettingModal.jsx";
import { useLocation, useNavigate } from "react-router";
import NAV_CONFIG from "../../config/navConfig.js";
import { useSystemStore } from "../../store/system";
import useIsMobile from "../../hooks/useIsMobile";
import { useUiStore } from "../../store/ui";
import HamburgerButton from "../HamburgerButton";

function Header() {
  const { t } = useTranslation();
  const [showSettingModal, setShowSettingModal] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const systemState = useSystemStore();
  const isMobile = useIsMobile();
  const navDrawerOpen = useUiStore((s) => s.navDrawerOpen);
  const setNavDrawerOpen = useUiStore((s) => s.setNavDrawerOpen);

  const goNav = (item) => {
    setNavDrawerOpen(false);
    // External entries (e.g. the developer / API platform app) leave the SPA.
    if (item.externalUrl) {
      window.location.assign(item.externalUrl);
      return;
    }
    navigate(item.path);
  };

  // Hide nav items whose `flagKey` resolves to a falsy system-store flag
  // (e.g. the Developer console is hidden unless isShowDeveloper is true).
  const navItems = NAV_CONFIG.filter(
    (item) => !item.flagKey || systemState[item.flagKey],
  );

  const isActive = (matchPaths) => {
    return matchPaths.some((path) =>
      path === "/" ? location.pathname === "/" : location.pathname.startsWith(path),
    );
  };

  return (
    <>
      <div className={styles.header}>
        <div className={styles.left}>
          {isMobile && (
            <HamburgerButton
              className="mr-[8px]"
              onClick={() => setNavDrawerOpen(true)}
            />
          )}
          <LogoSVG className={styles.logo_full} />
          <LogoShortSVG className={styles.logo_short} />
          <div className={styles.navs}>
            {navItems.map((item) => (
              <div
                key={item.key}
                className={`${styles.nav} ${
                  isActive(item.matchPaths) ? styles.nav_active : ""
                }`}
                onClick={() => goNav(item)}
              >
                {t(item.i18nKey)}
              </div>
            ))}
          </div>
        </div>
        {/* A real <button>, not a bare svg + onClick: the gear was not in the
            accessibility tree, so keyboard and screen-reader users could not
            open Settings at all, and the hit area was only the icon itself. */}
        <button
          type="button"
          aria-label={t("settings")}
          className="flex items-center cursor-pointer pr-[16px] bg-transparent border-0 p-0"
          onClick={() => setShowSettingModal(true)}
        >
          <SettingsSVG />
        </button>
      </div>
      <Drawer
        placement="left"
        open={isMobile && navDrawerOpen}
        onClose={() => setNavDrawerOpen(false)}
        size={Math.min(280, Math.round(window.innerWidth * 0.8))}
      >
        <div className={styles.nav_drawer_list}>
          {navItems.map((item) => (
            <div
              key={item.key}
              className={`${styles.nav_drawer_item} ${
                isActive(item.matchPaths) ? styles.nav_drawer_item_active : ""
              }`}
              onClick={() => goNav(item)}
            >
              {t(item.i18nKey)}
            </div>
          ))}
        </div>
      </Drawer>
      <SettingModal
        isOpen={showSettingModal}
        onClose={() => setShowSettingModal(false)}
      />
    </>
  );
}

export default Header;
