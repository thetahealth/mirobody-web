import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { IconLoader2, IconX } from "@tabler/icons-react";
import { logEntry, logSentence } from "../../../api/journal";
import {
  KINDS,
  NOTE_MAX,
  SENTENCE_MAX,
  TEXT_MAX,
  isoFromLocalInput,
  localInputFromDate,
  readSentence,
  reasonKey,
  sentenceUnsupported,
  skipKey,
  submitBlocker,
  valueOf,
} from "./entries.js";
import styles from "./Composer.module.scss";

/** One written entry: the words (and value), then what the vocabulary made of them. */
const Written = ({ entry, t }) => (
  <div className={`${styles.outcome} ${entry.coded ? styles.coded : styles.abstained}`}>
    <span className={styles.outcomeWords}>
      {entry.text}
      {valueOf(entry) ? ` ${valueOf(entry)}` : ""}
    </span>
    {entry.coded ? (
      <>
        <span className={styles.arrow}>→</span>
        <span className={styles.outcomeName}>{entry.display}</span>
        <code className={styles.outcomeCode}>{entry.code}</code>
      </>
    ) : (
      <>
        <span className={styles.outcomeName}>{t("journal_not_coded")}</span>
        <span className={styles.outcomeHint}>{t(reasonKey(entry.reason))}</span>
      </>
    )}
  </div>
);

/**
 * What a sentence became: every entry written, then every part that was not,
 * with the reason. The skipped half is shown on purpose: "没发烧" not appearing
 * in the log is correct, and the person should see that it was understood.
 */
const SentenceOutcome = ({ outcome, t }) => {
  const { written, skipped, alreadyLogged } = outcome;
  if (!written.length && !skipped.length && !alreadyLogged) {
    return <p className={styles.outcomeHint}>{t("journal_sentence_nothing")}</p>;
  }
  return (
    <div className={styles.outcomes} role="status">
      {written.map((entry) => (
        <Written key={entry.id} entry={entry} t={t} />
      ))}
      {alreadyLogged ? (
        <p className={styles.outcomeHint}>{t("journal_already_logged", { count: alreadyLogged })}</p>
      ) : null}
      {skipped.length ? (
        <div className={styles.skipped}>
          <span className={styles.label}>{t("journal_skipped_label")}</span>
          {skipped.map((part, i) => (
            <span key={`${part.quote}-${i}`} className={styles.skip}>
              <span className={styles.skipWords}>{part.quote || part.name}</span>
              <span className={styles.outcomeHint}>{t(skipKey(part.reason))}</span>
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
};

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
 *
 * It takes a sentence ("我头疼，血压150/95") and the server writes every entry
 * the sentence states. A server that cannot read a sentence (no text model, or
 * one that predates the route) drops the box back to one entry at a time with
 * a kind picker, for the rest of the session.
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
  const [sentence, setSentence] = useState(true);
  const [notice, setNotice] = useState("");
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
    const blocker = submitBlocker({ text, note, sentence });
    if (blocker) {
      setError(t(`journal_error_${blocker}`));
      return;
    }
    setBusy(true);
    setError("");
    const common = {
      text: text.trim(),
      observed_at: isoFromLocalInput(when) || undefined,
      target_user_id: targetUserId || undefined,
    };
    try {
      if (sentence) {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const data = await logSentence({ ...common, tz });
        setResult({ sentence: readSentence(data) });
      } else {
        const data = await logEntry({ ...common, kind, note: note.trim() || undefined });
        setResult({ single: data });
      }
      reset();
      onLogged?.();
      inputRef.current?.focus();
    } catch (e) {
      if (sentence && sentenceUnsupported(e)) {
        // Nothing was written: the words stay in the box for the one-entry form.
        setSentence(false);
        setNotice(t("journal_sentence_unavailable"));
        setOpen(true);
        return;
      }
      // The envelope carries the backend's own sentence (a range that is too
      // long, a kind it does not have, a write grant that is missing). It is
      // more specific than anything this component could say, so it is shown.
      setError(e?.msg || t("journal_error_failed"));
    } finally {
      setBusy(false);
    }
  };

  const placeholder = t(sentence ? "journal_placeholder_sentence" : `journal_placeholder_${kind}`);

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
          maxLength={(sentence ? SENTENCE_MAX : TEXT_MAX) + 1}
          placeholder={placeholder}
          onChange={(e) => {
            setText(e.target.value);
            if (e.target.value) setResult(null);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          aria-label={placeholder}
        />
        <button
          type="button"
          className={styles.submit}
          disabled={busy || !text.trim()}
          onClick={submit}
        >
          {busy ? <IconLoader2 size={14} className="animate-spin" /> : null}
          {busy ? t("journal_submitting") : t("journal_submit")}
        </button>
      </div>

      {notice ? <p className={styles.outcomeHint}>{notice}</p> : null}

      {open ? (
        <div className={styles.details}>
          {sentence ? null : (
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
          )}
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
          {sentence ? (
            <span className={styles.grow} />
          ) : (
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
          )}
          <button type="button" className={styles.cancel} onClick={reset}>
            <IconX size={13} stroke={2.2} />
          </button>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}

      {result?.sentence ? <SentenceOutcome outcome={result.sentence} t={t} /> : null}
      {result?.single ? <Written entry={result.single} t={t} /> : null}
    </section>
  );
};

export default Composer;
