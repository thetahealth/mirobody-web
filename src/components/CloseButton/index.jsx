import { IconX } from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";

/**
 * The × that closes a modal: a real button with a name and a hit area.
 *
 * The modals used to draw a 36px SVG with an onClick on it — the canvas was
 * the hit area, and there was no button for Tab or a screen reader to find.
 * Position it from the outside with `className`.
 */
const CloseButton = ({ onClick, className = "" }) => {
  const { t } = useTranslation();
  return (
    <button
      type="button"
      className={`${styles.close} ${className}`}
      aria-label={t("close")}
      onClick={onClick}
    >
      <IconX size={16} stroke={2} aria-hidden="true" />
    </button>
  );
};

export default CloseButton;
