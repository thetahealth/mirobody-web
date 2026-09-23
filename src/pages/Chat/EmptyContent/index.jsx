import { useOutletContext } from "react-router";
import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";

/**
 * The empty chat page: a greeting and the composer, and nothing else.
 *
 * It carried a second upload affordance until 2026-09-23 — a dashed card with
 * its own icon and copy, sitting above the composer that already has an attach
 * button and already accepts a dragged file anywhere in its own box
 * (`pages/Chat/Input`: onDragEnter / onDragOver / onDrop). Two doors to one
 * room, and the bigger one was the secondary action. Removing the card costs
 * no capability; the owner's word for how it looked was 别扭.
 */
const EmptyContent = () => {
  const { t } = useTranslation();
  // The composer, handed down by the chat page (see pages/Chat/index.jsx).
  // Optional: this route is only ever rendered with it, but a missing context
  // should not throw.
  const { composer } = useOutletContext() || {};

  return (
    <div className={styles.page}>
      <div className={styles.stack}>
        <div className={styles.title}>{t("hi_how_can_i_help_you_today")}</div>
        {composer}
      </div>
    </div>
  );
};

export default EmptyContent;
