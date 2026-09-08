import styles from "./index.module.scss";
import FormDownSVG from "../../../assets/form-down.svg?react";
import { Calendar } from "antd";
import { useState } from "react";
import dayjs from "dayjs";
import FormItemWrapper from "./index";
import useClickOutside from "../../../hooks/useClickOutside";

// Birthdays span well before the antd Calendar default year window
// (current ± 10). Bound the panel to 1900 → today so every realistic birth
// year is selectable and future dates are disabled.
const BIRTH_RANGE = [dayjs("1900-01-01"), dayjs()];

function FormItemDate(props) {
  const { onChange, value } = props;
  const [open, setOpen] = useState(false);

  // Use custom hook for click outside functionality
  const containerRef = useClickOutside(() => setOpen(false), open);

  const toggle = () => setOpen((o) => !o);

  // antd v5 Calendar fires onSelect for year/month panel switches too — only
  // commit the value and close the popover when an actual date cell is picked.
  // Otherwise switching year/month would close the calendar on the first click.
  const handleSelect = (date, info) => {
    if (info && info.source && info.source !== "date") return;
    onChange?.(date);
    setOpen(false);
  };

  return (
    <FormItemWrapper {...props}>
      <div className={styles.input_wrapper} ref={containerRef}>
        <div className={styles.input} onClick={toggle}>
          {value}
        </div>
        <div className={styles.arrow} onClick={toggle}>
          <FormDownSVG />
        </div>
        {open && (
          // Stop clicks inside the calendar (year/month nav, prev/next) from
          // bubbling up and toggling the popover shut.
          <div
            className={styles.calendar}
            onClick={(e) => e.stopPropagation()}
          >
            <Calendar
              fullscreen={false}
              validRange={BIRTH_RANGE}
              onSelect={handleSelect}
            />
          </div>
        )}
      </div>
    </FormItemWrapper>
  );
}

export default FormItemDate;
