import { IconAlertTriangle, IconCircleCheckFilled } from "@tabler/icons-react";
import styles from "./index.module.scss";
import {
  LINE_DONE,
  LINE_ERROR,
  statusLineFor,
} from "./statusLine";

const ChartLoadingIcon = () => {
  return (
    <div className={styles.loadingIcon} aria-hidden="true">
      <span />
      <span />
      <span />
    </div>
  );
};

const StatusIcon = ({ kind }) => {
  if (kind === LINE_DONE)
    return <IconCircleCheckFilled size={14} className={styles.doneIcon} aria-hidden="true" />;
  if (kind === LINE_ERROR)
    return <IconAlertTriangle size={14} stroke={1.8} className={styles.errorIcon} aria-hidden="true" />;
  return <ChartLoadingIcon />;
};

/**
 * The line above an answer. Everything it decides lives in `statusLine.js`,
 * which is a pure function of the messages and is tested there; this component
 * only picks an icon and prints the text.
 */
const StatusHeader = ({ datasource }) => {
  const { kind, text } = statusLineFor(datasource);

  return (
    <div className="flex items-center h-[36px] bg-[var(--color-bg-soft)] rounded-[12px] px-[12px] w-fit">
      <StatusIcon kind={kind} />
      <div className="text-[14px] text-[var(--color-text-primary)] font-[600] ml-[8px]">
        {text}
      </div>
    </div>
  );
};

export default StatusHeader;
