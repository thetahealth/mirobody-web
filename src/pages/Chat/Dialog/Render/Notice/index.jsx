import { IconInfoCircle } from "@tabler/icons-react";
import styles from "./index.module.scss";

/**
 * A `notice` block: the system talking to the user, not the model.
 *
 * "The model you picked isn't configured, so I used the default" is a fact
 * about the run, not part of the answer. It used to be folded into `thinking`,
 * where it sat among the model's own reasoning and read as something the model
 * had decided — telling the two apart is the whole reason the block exists, so
 * it must not look like either of its neighbours: lighter than the red `error`
 * card, and a plain visible bar rather than the collapsible reasoning block.
 */
const Notice = ({ content }) => {
  if (!content) return null;
  return (
    <div className={styles.notice} role="status">
      <IconInfoCircle className={styles.icon} size={14} aria-hidden="true" />
      <span className={styles.text}>{content}</span>
    </div>
  );
};

export default Notice;
