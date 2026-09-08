import styles from "./index.module.scss";
import FormDownSVG from "../../../assets/form-down.svg?react";
import { useState } from "react";
import FormItemWrapper from "./index";
import useClickOutside from "../../../hooks/useClickOutside";

function FormItemSelect(props) {
  const { onChange, value, options = [] } = props;
  const [open, setOpen] = useState(false);

  // Use custom hook for click outside functionality
  const containerRef = useClickOutside(() => setOpen(false), open);

  return (
    <FormItemWrapper {...props}>
      <div
        className={styles.input_wrapper}
        onClick={() => setOpen(!open)}
        ref={containerRef}
      >
        <div className={styles.input}>
          {options.find((option) => option.value === value)?.label}
        </div>
        <div className={styles.arrow}>
          <FormDownSVG />
        </div>
        {open && (
          <div className={styles.options}>
            {options.map((option) => (
              <div
                className={styles.option}
                key={option.value}
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
              >
                {option.label}
              </div>
            ))}
          </div>
        )}
      </div>
    </FormItemWrapper>
  );
}

export default FormItemSelect;
