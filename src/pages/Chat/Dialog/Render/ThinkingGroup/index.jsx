import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  IconAlertTriangle,
  IconBook,
  IconCalculator,
  IconChevronDown,
  IconDatabase,
  IconDna,
  IconFileText,
  IconFolder,
  IconLanguage,
  IconListCheck,
  IconMessageQuestion,
  IconPencil,
  IconPill,
  IconSparkles,
  IconTool,
} from "@tabler/icons-react";
import Markdown from "../Markdown";
import QueryDetail from "../QueryDetail";
import { STEP_THOUGHT, currentStep, durationOf, latestHeading, toSteps, toolCount } from "./steps";
import styles from "./index.module.scss";

const ICONS = {
  data: IconDatabase,
  pill: IconPill,
  dna: IconDna,
  calculator: IconCalculator,
  book: IconBook,
  file: IconFileText,
  folder: IconFolder,
  pencil: IconPencil,
  list: IconListCheck,
  language: IconLanguage,
  question: IconMessageQuestion,
  tool: IconTool,
};

const stepLabel = (t, step, running) =>
  t(`process_${step.kind.key}_${running ? "running" : "done"}`, { name: step.name });

// A clock that ticks once a second while the group is working.
function useNow(ticking) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!ticking) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [ticking]);
  return now;
}

function ToolStep({ step, running }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const Icon = ICONS[step.kind.icon] || IconTool;
  const canOpen = step.done && Boolean(step.detail);
  return (
    <div className={styles.step}>
      <button
        type="button"
        className={styles.step_row}
        onClick={() => canOpen && setOpen((v) => !v)}
        aria-expanded={canOpen ? open : undefined}
        disabled={!canOpen}
      >
        <Icon size={15} stroke={1.8} className={styles.step_icon} aria-hidden="true" />
        <span className={running ? `${styles.step_label} ${styles.shimmer}` : styles.step_label}>
          {stepLabel(t, step, running)}
        </span>
        {step.summary ? <span className={styles.step_summary}>{step.summary}</span> : null}
        {step.failed ? (
          <span className={styles.step_failed}>
            <IconAlertTriangle size={13} stroke={1.8} aria-hidden="true" />
            {t("process_failed")}
          </span>
        ) : null}
        {running ? <span className={styles.spinner} aria-hidden="true" /> : null}
        {canOpen ? (
          <IconChevronDown
            size={13}
            stroke={2}
            className={open ? `${styles.chevron} ${styles.chevron_open}` : styles.chevron}
            aria-hidden="true"
          />
        ) : null}
      </button>
      {open ? <QueryDetail content={step.detail} /> : null}
    </div>
  );
}

// The work behind an answer, the way Gemini and DeepSeek show it: open and
// streaming while the model thinks and calls tools, folded to one line ("Thought
// for 12s · 3 steps") once the answer begins. A reader who opened or closed it
// keeps their choice.
const ThinkingGroup = ({ datasource, active = false }) => {
  const { t } = useTranslation();
  const [userOpen, setUserOpen] = useState(null);
  const bodyRef = useRef(null);
  const now = useNow(active);
  const steps = toSteps(datasource);
  const open = userOpen ?? active;

  useEffect(() => {
    // Keep the newest line in view while the thinking streams.
    if (active && open && bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  });

  if (!steps.length) return null;

  const current = active ? currentStep(steps) : null;
  const seconds = durationOf(datasource, active ? now : undefined);
  const tools = toolCount(steps);

  let headline;
  if (active) {
    const detail =
      current && current.type !== STEP_THOUGHT ? current.summary : latestHeading(current?.text);
    headline = (
      <>
        <span className={styles.pulse} aria-hidden="true" />
        <span className={`${styles.head_label} ${styles.shimmer}`}>
          {current && current.type !== STEP_THOUGHT ? stepLabel(t, current, true) : t("process_thinking")}
        </span>
        {detail ? <span className={styles.head_detail}>{detail}</span> : null}
        {seconds ? <span className={styles.head_time}>{t("process_seconds", { count: seconds })}</span> : null}
      </>
    );
  } else {
    const parts = [seconds ? t("process_thought_for", { count: seconds }) : t("process_thought")];
    if (tools) parts.push(t("process_steps", { count: tools }));
    headline = (
      <>
        <IconSparkles size={15} stroke={1.8} className={styles.head_icon} aria-hidden="true" />
        <span className={styles.head_label}>{parts.join(" · ")}</span>
      </>
    );
  }

  return (
    <div className={active ? `${styles.process} ${styles.process_active}` : styles.process}>
      <button
        type="button"
        className={styles.head}
        onClick={() => setUserOpen(!open)}
        aria-expanded={open}
      >
        {headline}
        <IconChevronDown
          size={14}
          stroke={2}
          className={open ? `${styles.chevron} ${styles.chevron_open}` : styles.chevron}
          aria-hidden="true"
        />
      </button>
      {open ? (
        <div ref={bodyRef} className={active ? `${styles.body} ${styles.body_live}` : styles.body}>
          {steps.map((step, index) => {
            const running = active && index === steps.length - 1 && !step.done;
            return step.type === STEP_THOUGHT ? (
              <div key={step.id || index} className={styles.thought}>
                <Markdown content={step.text} />
              </div>
            ) : (
              <ToolStep key={step.id || index} step={step} running={running} />
            );
          })}
        </div>
      ) : null}
    </div>
  );
};

export default ThinkingGroup;
