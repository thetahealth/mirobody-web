import { useState } from "react";
import { message } from "antd";
import { useTranslation } from "react-i18next";
import consola from "consola";
import api from "../../api";
import styles from "./InviteSignIn.module.scss";

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());

/**
 * Give a virtual member their own login. You name their real address and get a
 * one-time link to pass on; they prove the address when they open it, and the
 * record you kept for them becomes theirs.
 */
export default function InviteSignIn({ member, onClose }) {
  const { t } = useTranslation();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const name = member.name || member.nickname || "";

  const onCreate = async () => {
    if (!isEmail(email) || busy) return;
    try {
      setBusy(true);
      setError("");
      setLink(await api.createActivation({ member_id: member.id, email: email.trim() }));
    } catch (err) {
      consola.error("ERROR: createActivation", err);
      setError(err?.msg || t("invite_sign_in_failed"));
    } finally {
      setBusy(false);
    }
  };

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(link.url);
      message.success(t("invite_sign_in_copied"));
    } catch {
      message.error(t("invite_sign_in_copy_failed"));
    }
  };

  return (
    <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
      <div className={styles.header}>
        <div className={styles.title}>{t("invite_sign_in_title", { name })}</div>
        <div className={styles.desc}>{t("invite_sign_in_desc", { name })}</div>
      </div>

      {!link ? (
        <>
          <label className={styles.field}>
            <span>{t("invite_sign_in_email_label", { name })}</span>
            <input
              type="email"
              value={email}
              placeholder={t("email_placeholder")}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onCreate()}
              autoFocus
            />
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <div className={styles.footer}>
            <button type="button" className={styles.secondary} onClick={onClose}>
              {t("cancel_btn")}
            </button>
            <button
              type="button"
              className={styles.primary}
              disabled={!isEmail(email) || busy}
              onClick={onCreate}
            >
              {t("invite_sign_in_create")}
            </button>
          </div>
        </>
      ) : (
        <>
          <div className={styles.linkRow}>
            <input readOnly value={link.url} onFocus={(e) => e.target.select()} />
            <button type="button" className={styles.primary} onClick={onCopy}>
              {t("invite_sign_in_copy")}
            </button>
          </div>
          <p className={styles.hint}>
            {t(link.sends_mail ? "invite_sign_in_hint_code" : "invite_sign_in_hint_password", {
              name,
              email: email.trim(),
              date: new Date(link.expires_at).toLocaleDateString(),
            })}
          </p>
          <div className={styles.footer}>
            <button type="button" className={styles.secondary} onClick={onClose}>
              {t("done")}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
