import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { CloseOutlined, LoadingOutlined } from "@ant-design/icons";
import { logEntry } from "../../../api/journal";
import {
  KINDS,
  NOTE_MAX,
  TEXT_MAX,
  isoFromLocalInput,
  localInputFromDate,
  reasonKey,
  submitBlocker,
} from "./entries.js";
import styles from "./Composer.module.scss";

/**
 * One box: what is wrong, in the person's own words.
 *
 * It expands in place rather than opening a dialog. Logging a symptom is a
 * five-second act, and a modal asks the person to change context for it.
 *
 * The part that matters is the answer, not the form. The backend codes the
 * words as it stores them and returns what it decided, so this shows the
 * standard name it landed on — or, when the vocabulary abstained, says so and
 * confirms the words were kept anyway. That feedback IS the feature: without
 * it this is a notes field, and a person has no way to see that "头痛" and
 * "headache" became the same thing.
 */
const Composer = ({ targetUserId, onLogged }) => {
  const { t } = useTranslation();
  const [text, setText] = useState("");
  const [kind, setKind] = useState(KINDS[0]);
  const [note, setNote] = useState("");
  const [when, setWhen] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  // The time field starts at "now", and re-stamps each time the box is opened:
  // a composer left open in a tab all morning should not file the afternoon's
  // entry under the morning.
  useEffect(() => {
    if (open && !when) setWhen(localInputFromDate(new Date()));
  }, [open, when]);

  // `kind` is deliberately NOT reset: someone entering their diagnoses enters
  // several in a row, and making them re-pick the axis each time is how the
  // second one ends up on the wrong one.
  const reset = () => {
    setText("");
    setNote("");
    setWhen("");
    setOpen(false);
    setError("");
  };

  const submit = async () => {
    const blocker = submitBlocker({ text, note });
    if (blocker) {
      setError(t(`journal_error_${blocker}`));
      return;
    }
    setBusy(true);
    setError("");
    try {
      const data = await logEntry({
        text: text.trim(),
        kind,
        note: note.trim() || undefined,
        observed_at: isoFromLocalInput(when) || undefined,
        target_user_id: targetUserId || undefined,
      });
      setResult(data);
      reset();
      onLogged?.();
      inputRef.current?.focus();
    } catch (e) {
      // The envelope carries the backend's own sentence (a range that is too
      // long, a kind it does not have, a write grant that is missing). It is
      // more specific than anything this component could say, so it is shown.
      setError(e?.msg || t("journal_error_failed"));
    } finally {
      setBusy(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey && !busy) {
      e.preventDefault();
      submit();
    }
    if (e.key === "Escape" && !text && !note) reset();
  };

  return (
    <section className={styles.composer}>
      <div className={styles.row}>
        <input
          ref={inputRef}
          name="journal-text"
          className={styles.input}
          value={text}
          maxLength={TEXT_MAX + 1}
          placeholder={t(`journal_placeholder_${kind}`)}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) setResult(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label={t(`journal_placeholder_${kind}`)}
        />
        <button
          type="button"
          className={styles.submit}
          disabled={busy || !text.trim()}
          onClick={submit}
        >
          {busy ? <LoadingOutlined /> : null}
          {busy ? t("journal_submitting") : t("journal_submit")}
        </button>
      </div>

      {open ? (
        <div className={styles.details}>
          <div className={styles.field}>
            <span className={styles.label}>{t("journal_kind_label")}</span>
            <div className={styles.kinds}>
              {KINDS.map((k) => (
                <button
                  key={k}
                  type="button"
                  className={`${styles.kind} ${kind === k ? styles.kindOn : ""}`}
                  onClick={() => setKind(k)}
                >
                  {t(`journal_kind_${k}`)}
                </button>
              ))}
            </div>
          </div>
          <label className={styles.field}>
            <span className={styles.label}>{t("journal_when")}</span>
            <input
              type="datetime-local"
              name="journal-when"
              className={styles.when}
              value={when}
              onChange={(e) => setWhen(e.target.value)}
            />
          </label>
          <label className={`${styles.field} ${styles.grow}`}>
            <span className={styles.label}>{t("journal_note_label")}</span>
            <input
              name="journal-note"
              className={styles.noteInput}
              value={note}
              maxLength={NOTE_MAX}
              placeholder={t("journal_note_placeholder")}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={onKeyDown}
            />
          </label>
          <button type="button" className={styles.cancel} onClick={reset}>
            <CloseOutlined />
          </button>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      {result ? (
        <div
          className={`${styles.outcome} ${result.coded ? styles.coded : styles.abstained}`}
          role="status"
        >
          {result.coded ? (
            <>
              <span className={styles.outcomeWords}>{result.text}</span>
              <span className={styles.arrow}>→</span>
              <span className={styles.outcomeName}>{result.display}</span>
              <code className={styles.outcomeCode}>{result.code}</code>
            </>
          ) : (
            <>
              <span className={styles.outcomeWords}>{result.text}</span>
              <span className={styles.outcomeName}>{t("journal_not_coded")}</span>
              <span className={styles.outcomeHint}>{t(reasonKey(result.reason))}</span>
            </>
          )}
        </div>
      ) : null}
    </section>
  );
};

export default Composer;
