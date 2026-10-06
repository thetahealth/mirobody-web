import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import consola from "consola";
import {
  IconArrowRight,
  IconBolt,
  IconCheck,
  IconCircleCheckFilled,
  IconClock,
  IconCloud,
  IconCopy,
  IconCpu,
  IconDatabase,
  IconDeviceDesktop,
  IconDownload,
  IconExternalLink,
  IconFileText,
  IconKey,
  IconLoader2,
  IconLock,
  IconMessageCircle,
  IconRefresh,
  IconShieldCheck,
  IconShieldLock,
} from "@tabler/icons-react";

import api from "../../api";
import { ACCESS_TOKEN } from "../../enum/storage";
import { useSystemStore } from "../../store/system";
import brandIcon from "../../assets/mirobody-icon.svg";
// Dark-ink wordmark, the one visible on the light canvas (as in AuthShell).
import wordmark from "../../assets/logo-wordmark-light.svg";
import LanguageSwitch from "../Login/components/LanguageSwitch";
import { loginReturningTo } from "../Login/returnPath";
import {
  captureSetupToken,
  guessPlatform,
  isReady,
  localModels,
  needsSignIn,
  rememberSetupToken,
  saveFailure,
  skipSetup,
  startCommand,
} from "./setup";
import styles from "./index.module.scss";

// A page a person opens, not a request the app makes: the guide lives in the
// backend repo, next to the compose profiles it explains.
const GUIDE_URL = "https://github.com/thetahealth/mirobody/blob/main/docs/local-models.md";
const PLATFORMS = ["mac", "gpu", "cpu", "other"];
// The preset the backend ships, for a server that does not say which it uses.
const DEFAULT_PRESET = "docker/local-models.ini";
// How often the page asks again while a local model downloads or loads.
const POLL_MS = 3000;

const cx = (...names) => names.filter(Boolean).join(" ");

/**
 * `/setup` — which model reads this deployment's health data: a vendor's, with
 * one API key, or open models on this machine.
 *
 * The first page of a new deployment (RootLayout sends every other page here
 * while `/mirobody.json` says `__MODEL_SETUP__: "needed"`), and Settings ›
 * Model comes back to it. It works signed out, because on a new deployment no
 * account exists yet; a save takes the setup token instead, and once a model
 * is set up a sign-in as well.
 */
export default function Setup() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [token, setToken] = useState(() => captureSetupToken());
  const [askToken, setAskToken] = useState(() => !token);
  const [signedIn] = useState(() => Boolean(localStorage.getItem(ACCESS_TOKEN)));
  const [setup, setSetup] = useState(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [mode, setMode] = useState("key");
  const [provider, setProvider] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [platform, setPlatform] = useState(guessPlatform);
  const [baseUrl, setBaseUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [savedMode, setSavedMode] = useState(null);
  const [copied, setCopied] = useState(false);
  // Set from the first answer only: the page keeps saying "first-run setup"
  // after that save turns `needed` off.
  const [firstRun, setFirstRun] = useState(false);
  const [signInRefused, setSignInRefused] = useState(false);

  // The poll below must send the token typed since it started, without
  // restarting on every keystroke.
  const tokenRef = useRef(token);
  useEffect(() => {
    tokenRef.current = token;
  }, [token]);

  const load = useCallback(async (signal) => {
    const sent = tokenRef.current;
    const next = await api.getSetup(signal, sent);
    // A token the server does not take (another deployment's, an old link)
    // is dropped here rather than at save time, after a key was typed.
    if (sent && !next.trusted) {
      rememberSetupToken("");
      setAskToken(true);
    }
    setSetup(next);
    return next;
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal)
      .then((first) => {
        // Preselect the service whose key is already set, else the first one
        // the page may change; a key in .env is not the page's to replace.
        const choosable = (first.providers || []).filter((p) => !p.in_env_file);
        setProvider((choosable.find((p) => p.set) || choosable[0] || {}).key || "");
        if (first.local?.configured) setMode("local");
        setFirstRun(!!first.needed);
      })
      .catch((err) => {
        if (err?.name === "CanceledError") return;
        // The error, not the request: it carries the setup token.
        consola.error("ERROR: getSetup", err?.code ?? err?.name);
        setLoadFailed(true);
      });
    return () => controller.abort();
  }, [load]);

  const local = setup?.local || {};
  const models = localModels(local);
  const waiting = Boolean(local.configured) && models.some((m) => !isReady(m.status));

  // The first local start downloads the models, which takes minutes; the page
  // shows each one arriving instead of a single "saved".
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => load().catch(() => {}), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  const save = async (body) => {
    if (saving || !token) return;
    try {
      setSaving(true);
      setError(null);
      await api.saveSetup(body, token);
      rememberSetupToken(token);
      setAskToken(false);
      setSavedMode(body.mode);
      await load();
      // `__MODEL_SETUP__` is "ready" now; without this RootLayout would keep
      // sending every page back here until a reload.
      useSystemStore.getState().initMirobodyConfig();
    } catch (err) {
      // The code, not the error: an axios error holds the key that was sent.
      consola.error("ERROR: saveSetup", err?.code ?? err?.name);
      const failure = saveFailure(err, body.mode);
      if (failure.forgetToken) {
        rememberSetupToken("");
        setAskToken(true);
      }
      if (failure.signIn) {
        setSignInRefused(true);
        return;
      }
      setError({ title: t(failure.reason), detail: failure.detail });
    } finally {
      setSaving(false);
    }
  };

  const openApp = () => navigate("/", { replace: true });

  const putOff = () => {
    skipSetup();
    openApp();
  };

  // Keep the token for the trip: the login page returns to /setup in this tab,
  // and a token typed into the field would otherwise have to be found again.
  const signIn = () => {
    rememberSetupToken(token);
    navigate(loginReturningTo("/setup"));
  };

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // no clipboard (http, or permission refused): the command stays selectable
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    if (mode === "key") {
      if (provider && apiKey.trim()) save({ mode: "key", name: provider, value: apiKey.trim() });
    } else {
      save({ mode: "local", base_url: baseUrl.trim() });
    }
  };

  let body;
  if (loadFailed || !setup) {
    body = <p className={styles.loading}>{t(loadFailed ? "setup_load_failed" : "loading")}</p>;
  } else {
    const keySaved = mode === "key" && savedMode === "key" && !setup.needed;
    const localSaved = mode === "local" && local.configured;
    const chosen = (setup.providers || []).find((p) => p.key === provider);
    const command = startCommand(platform, local.preset || DEFAULT_PRESET);
    const canSubmit = token && !saving && (mode === "local" || (provider && apiKey.trim()));
    const mustSignIn = signInRefused || needsSignIn({ needed: setup.needed, signedIn });

    body = (
      <>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>
            {t(firstRun ? "setup_eyebrow_first" : "setup_eyebrow_change")}
          </span>
          <h1 className={styles.title}>
            {t(firstRun ? "setup_title_first" : "setup_title_change")}
          </h1>
          <p className={styles.lead}>{t("setup_intro")}</p>
          <ul className={styles.promises}>
            <li>
              <IconDatabase size={16} stroke={1.8} aria-hidden="true" />
              {t("setup_promise_record")}
            </li>
            <li>
              <IconLock size={16} stroke={1.8} aria-hidden="true" />
              {t("setup_promise_encrypted")}
            </li>
            <li>
              <IconRefresh size={16} stroke={1.8} aria-hidden="true" />
              {t("setup_promise_change")}
            </li>
          </ul>
          {!firstRun && setup.chat_model && (
            <p className={styles.current}>{t("setup_current", { model: setup.chat_model })}</p>
          )}
        </section>

        <div className={styles.choices} role="radiogroup">
          <Choice
            on={mode === "key"}
            tone="cloud"
            icon={<IconCloud size={24} stroke={1.6} aria-hidden="true" />}
            badge={t("setup_badge_fast")}
            title={t("setup_mode_key")}
            desc={t("setup_mode_key_desc")}
            facts={[
              [<IconBolt size={15} stroke={1.8} />, t("setup_row_speed"), t("setup_key_speed")],
              [<IconShieldLock size={15} stroke={1.8} />, t("setup_row_privacy"), t("setup_key_privacy")],
              [<IconKey size={15} stroke={1.8} />, t("setup_row_needs"), t("setup_key_needs")],
            ]}
            onSelect={() => {
              setMode("key");
              setError(null);
            }}
          />
          <Choice
            on={mode === "local"}
            tone="local"
            icon={<IconDeviceDesktop size={24} stroke={1.6} aria-hidden="true" />}
            badge={t("setup_badge_private")}
            title={t("setup_mode_local")}
            desc={t("setup_mode_local_desc")}
            facts={[
              [<IconClock size={15} stroke={1.8} />, t("setup_row_speed"), t("setup_local_speed")],
              [<IconShieldLock size={15} stroke={1.8} />, t("setup_row_privacy"), t("setup_local_privacy")],
              [
                <IconCpu size={15} stroke={1.8} />,
                t("setup_row_needs"),
                t("setup_local_needs", { gb: local.memory_gb }),
              ],
            ]}
            onSelect={() => {
              setMode("local");
              setError(null);
            }}
          />
        </div>

        <form className={styles.panel} onSubmit={onSubmit}>
          {mode === "key" ? (
            <div className={styles.columns}>
              <div className={styles.column}>
                <Step n={1}>{t("setup_key_pick")}</Step>
                <div className={styles.providers} role="radiogroup">
                  {(setup.providers || []).map((p) => (
                    <label
                      key={p.key}
                      className={cx(
                        styles.provider,
                        provider === p.key && styles.providerOn,
                        p.in_env_file && styles.providerFixed,
                      )}
                    >
                      <input
                        type="radio"
                        name="provider"
                        className={styles.srOnly}
                        value={p.key}
                        checked={provider === p.key}
                        disabled={p.in_env_file}
                        onChange={() => setProvider(p.key)}
                      />
                      <span className={styles.providerName}>{p.label}</span>
                      <span className={styles.providerModel}>
                        {p.in_env_file ? t("setup_key_in_env") : p.model}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className={styles.column}>
                <Step n={2}>{t("setup_key_paste")}</Step>
                {chosen && (
                  <a href={chosen.get_key_url} target="_blank" rel="noreferrer" className={styles.link}>
                    {t("setup_key_get_for", { label: chosen.label })}
                    <IconExternalLink size={13} stroke={1.8} aria-hidden="true" />
                  </a>
                )}
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="off"
                  value={apiKey}
                  placeholder={t("setup_key_placeholder")}
                  onChange={(e) => setApiKey(e.target.value)}
                  aria-label={t("setup_key_paste")}
                />
                <p className={styles.hint}>
                  <IconLock size={14} stroke={1.8} aria-hidden="true" />
                  <span>{t("setup_key_stored")}</span>
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className={styles.stats}>
                <Stat
                  icon={<IconDownload size={18} stroke={1.8} aria-hidden="true" />}
                  label={t("setup_stat_download")}
                  value={`${local.download_gb} GB`}
                  hint={t("setup_stat_download_hint")}
                />
                <Stat
                  icon={<IconCpu size={18} stroke={1.8} aria-hidden="true" />}
                  label={t("setup_stat_memory")}
                  value={`~${local.memory_gb} GB`}
                  hint={t("setup_stat_memory_hint")}
                />
                <Stat
                  icon={<IconClock size={18} stroke={1.8} aria-hidden="true" />}
                  label={t("setup_stat_speed")}
                  value={t("setup_stat_speed_value")}
                  hint={t("setup_stat_speed_hint")}
                />
              </div>
              <div className={styles.columns}>
                <div className={styles.column}>
                  <Step n={1}>{t("setup_local_what")}</Step>
                  <ul className={styles.models}>
                    {models.map((m) => {
                      const reads = m.model === local.models?.ocr;
                      return (
                        <li key={m.model}>
                          <span className={styles.modelIcon}>
                            {reads ? (
                              <IconFileText size={18} stroke={1.8} aria-hidden="true" />
                            ) : (
                              <IconMessageCircle size={18} stroke={1.8} aria-hidden="true" />
                            )}
                          </span>
                          <span className={styles.modelText}>
                            <code>{m.model}</code>
                            <small>{t(reads ? "setup_local_role_ocr" : "setup_local_role_agent")}</small>
                          </span>
                          {local.configured && <StatusPill status={m.status} t={t} />}
                        </li>
                      );
                    })}
                  </ul>
                  <p className={styles.hint}>{t("setup_local_open")}</p>
                </div>
                <div className={styles.column}>
                  <Step n={2}>{t("setup_local_start")}</Step>
                  {local.configured ? (
                    <div className={cx(styles.notice, waiting ? styles.noticeWait : styles.noticeOk)}>
                      {waiting ? (
                        <IconLoader2 className={styles.spin} size={18} stroke={1.8} aria-hidden="true" />
                      ) : (
                        <IconCircleCheckFilled size={18} aria-hidden="true" />
                      )}
                      <span>{t(waiting ? "setup_local_saved" : "setup_local_all_ready")}</span>
                    </div>
                  ) : (
                    <>
                      <div className={styles.segmented} role="tablist">
                        {PLATFORMS.map((p) => (
                          <button
                            key={p}
                            type="button"
                            role="tab"
                            aria-selected={platform === p}
                            className={cx(styles.segment, platform === p && styles.segmentOn)}
                            onClick={() => setPlatform(p)}
                          >
                            {t(`setup_local_os_${p}`)}
                          </button>
                        ))}
                      </div>
                      <p className={styles.hint}>{t(`setup_local_${platform}_note`)}</p>
                      {command && (
                        <div className={styles.terminal}>
                          <div className={styles.terminalBar}>
                            <span />
                            <span />
                            <span />
                            <button type="button" onClick={() => copy(command)} aria-label={t("setup_copy")}>
                              {copied ? <IconCheck size={14} stroke={2} /> : <IconCopy size={14} stroke={1.8} />}
                              {t("setup_copy")}
                            </button>
                          </div>
                          <pre>
                            {command.split("\n").map((line) => (
                              <code key={line}>{line}</code>
                            ))}
                          </pre>
                        </div>
                      )}
                      <a href={GUIDE_URL} target="_blank" rel="noreferrer" className={styles.link}>
                        {t("setup_local_guide")}
                        <IconExternalLink size={13} stroke={1.8} aria-hidden="true" />
                      </a>
                      <details className={styles.advanced}>
                        <summary>{t("setup_local_address")}</summary>
                        <input
                          className={styles.input}
                          type="url"
                          value={baseUrl}
                          placeholder={(local.candidates || [])[0] || ""}
                          onChange={(e) => setBaseUrl(e.target.value)}
                        />
                        <small>
                          {t("setup_local_address_hint", { list: (local.candidates || []).join(", ") })}
                        </small>
                      </details>
                    </>
                  )}
                </div>
              </div>
            </>
          )}

          <footer className={styles.footer}>
            {askToken ? (
              <label className={styles.token}>
                <span className={styles.tokenLabel}>
                  <IconLock size={15} stroke={1.8} aria-hidden="true" />
                  {t("setup_token_label")}
                </span>
                <input
                  className={styles.input}
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value.trim())}
                />
                <small>{t("setup_token_hint")}</small>
                {/* The app prints the link only while it has no model; after
                    that the token is in .env alone. */}
                {setup.needed && <small>{t("setup_token_hint_log")}</small>}
              </label>
            ) : (
              <span className={styles.verified}>
                <IconShieldCheck size={16} stroke={1.8} aria-hidden="true" />
                {t("setup_token_accepted")}
              </span>
            )}
            <div className={styles.actions}>
              {error && (
                <p className={styles.error} role="alert">
                  <strong>{error.title}</strong>
                  {error.detail && <span>{error.detail}</span>}
                </p>
              )}
              {keySaved && (
                <p className={styles.success}>
                  <IconCircleCheckFilled size={16} aria-hidden="true" />
                  {t("setup_key_saved", { model: setup.chat_model })}
                </p>
              )}
              {keySaved || localSaved ? (
                <button type="button" className={styles.primary} onClick={openApp}>
                  {t("setup_open")}
                  <IconArrowRight size={16} stroke={2} aria-hidden="true" />
                </button>
              ) : mustSignIn ? (
                <>
                  <p className={styles.signIn} role={signInRefused ? "alert" : undefined}>
                    {t("setup_sign_in_needed")}
                  </p>
                  <button type="button" className={styles.primary} onClick={signIn}>
                    {t("sign_in")}
                    <IconArrowRight size={16} stroke={2} aria-hidden="true" />
                  </button>
                </>
              ) : (
                <button type="submit" className={styles.primary} disabled={!canSubmit}>
                  {saving && <IconLoader2 className={styles.spin} size={16} stroke={2} aria-hidden="true" />}
                  {t(
                    saving
                      ? mode === "key"
                        ? "setup_key_checking"
                        : "setup_local_checking"
                      : mode === "key"
                        ? "setup_key_submit"
                        : "setup_local_submit",
                  )}
                  {!saving && <IconArrowRight size={16} stroke={2} aria-hidden="true" />}
                </button>
              )}
            </div>
          </footer>
        </form>

        {setup.needed && (
          <button type="button" className={styles.skip} onClick={putOff}>
            {t("setup_skip")}
          </button>
        )}
      </>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.topbar}>
        <span className={styles.brand}>
          <img src={brandIcon} alt="" />
          <img src={wordmark} alt="Mirobody" className={styles.wordmark} />
        </span>
        <LanguageSwitch />
      </header>
      <main className={styles.main}>{body}</main>
    </div>
  );
}

/** One of the two ways to run the model, as a large radio card. */
function Choice({ on, tone, icon, badge, title, desc, facts, onSelect }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      className={cx(styles.choice, styles[`tone_${tone}`], on && styles.choiceOn)}
      onClick={onSelect}
    >
      <span className={styles.choiceHead}>
        <span className={styles.choiceIcon}>{icon}</span>
        <span className={styles.badge}>{badge}</span>
        <span className={styles.check} aria-hidden="true">
          {on && <IconCircleCheckFilled size={22} />}
        </span>
      </span>
      <span className={styles.choiceTitle}>{title}</span>
      <span className={styles.choiceDesc}>{desc}</span>
      <span className={styles.choiceFacts}>
        {facts.map(([factIcon, label, value]) => (
          <span key={label} className={styles.fact}>
            <span className={styles.factLabel}>
              {factIcon}
              {label}
            </span>
            <span className={styles.factValue}>{value}</span>
          </span>
        ))}
      </span>
    </button>
  );
}

function Step({ n, children }) {
  return (
    <h2 className={styles.stepTitle}>
      <span className={styles.stepNumber}>{n}</span>
      {children}
    </h2>
  );
}

function Stat({ icon, label, value, hint }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>
        {icon}
        {label}
      </span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statHint}>{hint}</span>
    </div>
  );
}

/** A local model's state as the model server reports it. */
function StatusPill({ status, t }) {
  const ready = isReady(status);
  return (
    <span className={cx(styles.pill, ready ? styles.pillOk : styles.pillWait)}>
      {!ready && status !== "missing" && (
        <IconLoader2 className={styles.spin} size={12} stroke={2} aria-hidden="true" />
      )}
      {t(`setup_status_${ready ? "loaded" : status}`, { defaultValue: status })}
    </span>
  );
}
