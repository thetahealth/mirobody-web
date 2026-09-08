import styles from "./index.module.scss";
import FormItemWrapper from "./index";

function FormItemInput(props) {
  const {
    placeholder,
    onChange,
    value,
    showCounter = false,
    maxLength = 100,
  } = props;
  return (
    <FormItemWrapper {...props}>
      <div className={styles.input_wrapper}>
        <input
          className={styles.input}
          placeholder={placeholder}
          onChange={onChange}
          value={value}
        />
        {showCounter && (
          <div className={styles.counter}>
            {value.length}/{maxLength}
          </div>
        )}
      </div>
    </FormItemWrapper>
  );
}

export default FormItemInput;
