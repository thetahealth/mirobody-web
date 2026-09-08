import { useTranslation } from "react-i18next";
import GoogleIconSVG from "../../../assets/google-icon.svg?react";
import AppleIconSVG from "../../../assets/apple-icon.svg?react";
import styles from "./SocialButtons.module.scss";

/**
 * Overseas alternate methods — Google (outlined) + Apple (solid ink). Handlers +
 * loading flags come from the parent (which owns the firebase/redirect flow).
 */
export default function SocialButtons({
  showGoogle,
  showApple,
  onGoogle,
  onApple,
  googleLoading,
  appleLoading,
}) {
  const { t } = useTranslation();
  return (
    <div className={styles.group}>
      {showGoogle && (
        <button
          type="button"
          className={`${styles.btn} ${styles.google}`}
          onClick={onGoogle}
          disabled={googleLoading}
        >
          <GoogleIconSVG className={styles.icon} />
          <span className={googleLoading ? styles.loading : ""}>
            {googleLoading ? t("google_signing_in") : t("sign_in_with_google")}
          </span>
        </button>
      )}
      {showApple && (
        <button
          type="button"
          className={`${styles.btn} ${styles.apple}`}
          onClick={onApple}
          disabled={appleLoading}
        >
          <AppleIconSVG className={styles.icon} />
          <span className={appleLoading ? styles.loading : ""}>
            {appleLoading ? t("apple_signing_in") : t("sign_in_with_apple")}
          </span>
        </button>
      )}
    </div>
  );
}
