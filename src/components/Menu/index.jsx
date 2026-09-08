import styles from "./index.module.scss";
import useIsMobile from "../../hooks/useIsMobile";

const Menu = ({
  minWidth = 88,
  maxWidth = 380,
  children,
  isExpanded = false,
}) => {
  const isMobile = useIsMobile();
  // On mobile this renders inside a Drawer — the drawer IS the panel, so fill
  // its width instead of using the desktop collapsible-rail widths.
  const width = isMobile ? "100%" : isExpanded ? maxWidth : minWidth;
  return (
    <div
      className={styles.menu}
      style={{
        width,
        minWidth: width,
        backgroundColor: "var(--color-bg-soft)",
      }}
    >
      {children}
    </div>
  );
};

export default Menu;
