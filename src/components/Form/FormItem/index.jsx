import styles from "./index.module.scss";

function FormItem({
  label,
  required,
  errorMessage = "",
  children,
  error = false,
}) {
  return (
    <div
      className={`${styles.form_item} ${error ? styles.form_item_error : ""}`}
    >
      <div className={styles.label}>
        <div className={styles.label_text}>{label}</div>
        {required && <span className={styles.required}>*</span>}
      </div>
      {children}
      {error && <div className={styles.error}>{errorMessage}</div>}
    </div>
  );
}

export default FormItem;
