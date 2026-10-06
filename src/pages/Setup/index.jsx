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
  IconExternalLink,
  IconFileText,
  IconKey,
  IconLoader2,
  IconLock,
  IconMessageCircle,
  IconRefresh,
  IconSearch,
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
  answerTime,
  badModelName,
  captureSetupToken,
  guessPlatform,
  isReady,
  keyChoice,
  localChoice,
  localModels,
  modelDraft,
  modelEditable,
  modelInEffect,
  needsSignIn,
  notServed,
  offersDefault,
  oneDecimal,
  pickTier,
  presetModels,
  rememberSetupToken,
  saveFailure,
  servedChoices,
  skipSetup,
  startCommand,
  tierBadge,
  tierFor,
  tierHardware,
  tierOnServer,
} from "./setup";
import styles from "./index.module.scss";

// A page a person opens, not a request the app makes: the guide lives in the
// backend repo, next to the compose profiles it explains.
const GUIDE_URL = "https://github.com/thetahealth/mirobody/blob/main/docs/local-models.md";
const PLATFORMS = ["mac", "windows", "gpu", "cpu", "other"];
// The preset the backend ships, for a server that does not say which it uses.
const DEFAULT_PRESET = "docker/local-models.ini";
// How often the page asks again while a local model downloads or loads.
const POLL_MS = 3000;

const cx = (...names) => names.filter(Boolean).join(" ");

/**
 * `/setup` — which model reads this deployment's health data: a vendor's, with
 * one API key, or open models on this machine; and, in either case, which
 * model by name, because vendors rename theirs faster than releases ship.
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
  // The model names typed for the chosen service; they start as the ones in use.
  const [chatModel, setChatModel] = useState("");
  const [utilsModel, setUtilsModel] = useState("");
  const [platform, setPlatform] = useState(guessPlatform);
  const [baseUrl, setBaseUrl] = useState("");
  // The local pair: a size sets both, "Other model" either one. A lookup of
  // the server says which of them it has.
  const [found, setFound] = useState(null);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState(null);
  const [agentChoice, setAgentChoice] = useState("");
  const [ocrChoice, setOcrChoice] = useState("");
  const [saving, setSaving] = useState(false);
  const [elapsed, setElapsed] = useState(0);
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
        const preselected = choosable.find((p) => p.set) || choosable[0];
        setProvider(preselected?.key || "");
        setChatModel(modelDraft(preselected?.chat_model));
        setUtilsModel(modelDraft(preselected?.utils_model));
        const tier = (first.local?.tiers || []).find((t) => t.id === pickTier(first.local));
        setAgentChoice(tier?.agent || modelDraft(first.local?.model_fields?.agent));
        setOcrChoice(tier?.ocr || modelDraft(first.local?.model_fields?.ocr));
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
  const fields = local.model_fields || {};

  // The first local start downloads the models, which takes minutes; the page
  // shows each one arriving instead of a single "saved".
  useEffect(() => {
    if (!waiting) return undefined;
    const timer = setInterval(() => load().catch(() => {}), POLL_MS);
    return () => clearInterval(timer);
  }, [waiting, load]);

  // A key is checked with one real request, which can take a minute and a
  // half; a counter shows the page has not stalled.
  useEffect(() => {
    if (!saving) return undefined;
    const started = Date.now();
    const timer = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [saving]);

  // Any change after a save is a new choice: the page offers to save again.
  const edited = () => {
    setSavedMode(null);
    setError(null);
  };

  const pickSize = (tier) => {
    setAgentChoice(tier.agent);
    setOcrChoice(tier.ocr || "");
    edited();
  };

  const pickProvider = (p) => {
    setProvider(p.key);
    setChatModel(modelDraft(p.chat_model));
    setUtilsModel(modelDraft(p.utils_model));
    edited();
  };

  const save = async (body) => {
    if (saving || !token) return;
    try {
      setElapsed(0);
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

  const find = async () => {
    if (finding || !token) return;
    try {
      setFinding(true);
      setFindError(null);
      edited();
      // The pair stays as chosen: the lookup says whether the server has it.
      setFound(await api.findLocalServer(baseUrl.trim(), token));
    } catch (err) {
      consola.error("ERROR: findLocalServer", err?.code ?? err?.name);
      const failure = saveFailure(err, "find");
      if (failure.forgetToken) {
        rememberSetupToken("");
        setAskToken(true);
      }
      setFound(null);
      setFindError({ title: t(failure.reason), detail: failure.detail });
    } finally {
      setFinding(false);
    }
  };

  const openApp = () => navigate("/", { replace: true });

  // After a save: into the app, or to sign in first. On a new deployment no
  // account exists yet, and the sign-in page is where one is made.
  const proceed = () => (signedIn ? openApp() : navigate("/login"));

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

  const chosen = (setup?.providers || []).find((p) => p.key === provider);
  const missing = found ? notServed(found.served, [agentChoice, ocrChoice]) : [];

  const onSubmit = (event) => {
    event.preventDefault();
    if (mode === "key") {
      if (!provider || !apiKey.trim()) return;
      save(
        keyChoice({
          provider,
          apiKey,
          chatField: chosen?.chat_model,
          chatTyped: chatModel,
          utilsField: chosen?.utils_model,
          utilsTyped: utilsModel,
        }),
      );
    } else {
      // The address that answered the lookup, else the one typed, else the
      // server tries its usual ones. It refuses a pair the server lacks.
      save(
        localChoice({
          baseUrl: found?.base_url || baseUrl,
          agentField: fields.agent,
          agentChosen: agentChoice,
          ocrField: fields.ocr,
          ocrChosen: ocrChoice,
        }),
      );
    }
  };

  let body;
  if (loadFailed || !setup) {
    body = <p className={styles.loading}>{t(loadFailed ? "setup_load_failed" : "loading")}</p>;
  } else {
    const keySaved = mode === "key" && savedMode === "key" && !setup.needed;
    const localSaved = mode === "local" && savedMode === "local" && local.configured;
    const command = startCommand(platform, local.preset || DEFAULT_PRESET);
    const chatInEffect = modelInEffect(chosen?.chat_model, chatModel);
    const utilsInEffect = modelInEffect(chosen?.utils_model, utilsModel);
    const badName =
      (modelEditable(chosen?.chat_model) && badModelName(chatModel)) ||
      (modelEditable(chosen?.utils_model) && badModelName(utilsModel));
    const canSubmit =
      token &&
      !saving &&
      (mode === "local" ? missing.length === 0 : Boolean(provider && apiKey.trim() && !badName));
    const mustSignIn = signInRefused || needsSignIn({ needed: setup.needed, signedIn });
    const candidates = local.candidates || [];
    const tiers = local.tiers || [];
    const selectedTier = tierFor(tiers, agentChoice, ocrChoice);
    const pairOnServer = found && selectedTier ? tierOnServer(selectedTier, found.served) : "";
    // Step numbers shift by one when there are sizes to choose first.
    const step = tiers.length > 0 ? 1 : 0;
    // What runs: the pair chosen, with its state where one is known (the
    // lookup's answer, or the status of the models set up now).
    const servedStatus = new Map((found?.served || []).map((m) => [m.id, m.status]));
    const statusOf = (model, role) =>
      found
        ? servedStatus.get(model) || "missing"
        : local.configured && model === local.models?.[role]
          ? local.status?.[role] || "missing"
          : "";
    const pair = agentChoice
      ? [
          { model: agentChoice, reads: false, status: statusOf(agentChoice, "agent") },
          ...(ocrChoice && ocrChoice !== agentChoice
            ? [{ model: ocrChoice, reads: true, status: statusOf(ocrChoice, "ocr") }]
            : []),
        ]
      : models.map((m) => ({
          model: m.model,
          reads: m.model === local.models?.ocr,
          status: local.configured ? m.status : "",
        }));

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
                t("setup_local_needs"),
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
                        onChange={() => pickProvider(p)}
                      />
                      <span className={styles.providerName}>{p.label}</span>
                      <span className={styles.providerModel}>
                        {p.in_env_file ? t("setup_key_in_env") : p.model}
                      </span>
                    </label>
                  ))}
                </div>
                {chosen && (
                  <ModelField
                    id="setup-chat-model"
                    label={t("setup_model_label")}
                    field={chosen.chat_model}
                    value={chatModel}
                    onChange={(value) => {
                      setChatModel(value);
                      edited();
                    }}
                    hint={t("setup_model_hint", { label: chosen.label })}
                    t={t}
                  />
                )}
                {chosen && modelDraft(chosen.utils_model) && (
                  <details className={styles.advanced}>
                    <summary>{t("setup_advanced")}</summary>
                    <ModelField
                      id="setup-utils-model"
                      label={t("setup_utils_model_label")}
                      field={chosen.utils_model}
                      value={utilsModel}
                      onChange={(value) => {
                        setUtilsModel(value);
                        edited();
                      }}
                      t={t}
                    />
                  </details>
                )}
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
                  onChange={(e) => {
                    setApiKey(e.target.value);
                    edited();
                  }}
                  aria-label={t("setup_key_paste")}
                />
                {chatInEffect && (
                  <p className={styles.turnsOn}>
                    <IconBolt size={15} stroke={1.8} aria-hidden="true" />
                    <span>
                      {utilsInEffect
                        ? t("setup_key_turns_on", { chat: chatInEffect, utils: utilsInEffect })
                        : t("setup_key_turns_on_chat", { chat: chatInEffect })}
                    </span>
                  </p>
                )}
                <p className={styles.hint}>
                  <IconLock size={14} stroke={1.8} aria-hidden="true" />
                  <span>{t("setup_key_stored")}</span>
                </p>
              </div>
            </div>
          ) : (
            <>
              {tiers.length > 0 && (
                <div className={styles.sizes}>
                  <Step n={1}>{t("setup_tier_title")}</Step>
                  <p className={styles.hint}>{t("setup_tier_intro")}</p>
                  <div className={styles.tiers} role="radiogroup" aria-label={t("setup_tier_title")}>
                    {tiers.map((tier) => (
                      <TierCard
                        key={tier.id}
                        tier={tier}
                        on={selectedTier?.id === tier.id}
                        onServer={found ? tierOnServer(tier, found.served) : ""}
                        onSelect={() => pickSize(tier)}
                        t={t}
                      />
                    ))}
                  </div>
                </div>
              )}
              <div className={styles.columns}>
                <div className={styles.column}>
                  <Step n={step + 1}>{t("setup_local_what")}</Step>
                  <ul className={styles.models}>
                    {pair.map((m) => (
                      <li key={m.model}>
                        <span className={styles.modelIcon}>
                          {m.reads ? (
                            <IconFileText size={18} stroke={1.8} aria-hidden="true" />
                          ) : (
                            <IconMessageCircle size={18} stroke={1.8} aria-hidden="true" />
                          )}
                        </span>
                        <span className={styles.modelText}>
                          <code>{m.model}</code>
                          <small>{t(m.reads ? "setup_local_role_ocr" : "setup_local_role_agent")}</small>
                        </span>
                        {m.status && <StatusPill status={m.status} t={t} />}
                      </li>
                    ))}
                  </ul>
                  <p className={styles.hint}>{t("setup_local_open")}</p>
                </div>
                <div className={styles.column}>
                  <Step n={step + 2}>{t("setup_local_start")}</Step>
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
                      {command.includes("--models-max") && (
                        <p className={styles.hint}>{t("setup_local_models_max")}</p>
                      )}
                      <a href={GUIDE_URL} target="_blank" rel="noreferrer" className={styles.link}>
                        {t("setup_local_guide")}
                        <IconExternalLink size={13} stroke={1.8} aria-hidden="true" />
                      </a>
                    </>
                  )}
                </div>
              </div>

              <div className={styles.find}>
                <Step n={step + 3}>{t("setup_find_title")}</Step>
                <p className={styles.hint}>{t("setup_find_intro")}</p>
                <label className={styles.fieldLabel} htmlFor="setup-base-url">
                  {t("setup_local_address")}
                </label>
                <div className={styles.findRow}>
                  <input
                    id="setup-base-url"
                    className={styles.input}
                    type="url"
                    value={baseUrl}
                    placeholder={candidates[0] || ""}
                    onChange={(e) => {
                      setBaseUrl(e.target.value);
                      setFound(null);
                      edited();
                    }}
                  />
                  <button type="button" className={styles.secondary} onClick={find} disabled={finding || !token}>
                    {finding ? (
                      <IconLoader2 className={styles.spin} size={16} stroke={2} aria-hidden="true" />
                    ) : (
                      <IconSearch size={16} stroke={2} aria-hidden="true" />
                    )}
                    {t(finding ? "setup_finding" : "setup_find_button")}
                  </button>
                </div>
                <small className={styles.findHint}>
                  {t("setup_local_address_hint", { list: candidates.join(", ") })}
                </small>
                {findError && (
                  <p className={styles.error} role="alert">
                    <strong>{findError.title}</strong>
                    {findError.detail && <span>{findError.detail}</span>}
                  </p>
                )}
                {found && (
                  <div className={styles.found}>
                    <p className={styles.foundAt}>
                      <IconCircleCheckFilled size={16} aria-hidden="true" />
                      {t("setup_find_found", { url: found.base_url })}
                    </p>
                    {pairOnServer && pairOnServer !== "missing" && (
                      <div className={cx(styles.notice, pairOnServer === "loaded" ? styles.noticeOk : styles.noticeWait)}>
                        <IconCircleCheckFilled size={18} aria-hidden="true" />
                        <span>{t(pairOnServer === "loaded" ? "setup_pair_loaded" : "setup_pair_unloaded")}</span>
                      </div>
                    )}
                    {/* Any model the preset serves, for a pair no size makes
                        up. Open on its own when the pair is already one. */}
                    <details className={styles.advanced} open={!selectedTier || undefined}>
                      <summary>{t("setup_other_model")}</summary>
                      <div className={styles.roles}>
                        <RoleSelect
                          id="setup-agent-model"
                          label={t("setup_role_agent")}
                          field={fields.agent}
                          choices={servedChoices(presetModels(found.served), agentChoice)}
                          value={agentChoice}
                          onChange={(value) => {
                            setAgentChoice(value);
                            edited();
                          }}
                          t={t}
                        />
                        <RoleSelect
                          id="setup-ocr-model"
                          label={t("setup_role_ocr")}
                          field={fields.ocr}
                          choices={servedChoices(presetModels(found.served), ocrChoice)}
                          value={ocrChoice}
                          onChange={(value) => {
                            setOcrChoice(value);
                            edited();
                          }}
                          t={t}
                        />
                      </div>
                    </details>
                    {missing.length > 0 && (
                      <p className={styles.warn} role="alert">
                        {t("setup_not_served", { models: missing.join(", ") })}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          <p className={styles.privacy}>
            <IconShieldLock size={15} stroke={1.8} aria-hidden="true" />
            <span>
              {mode === "local"
                ? t("setup_privacy_local")
                : chosen
                  ? t("setup_privacy_key", { label: chosen.label })
                  : t("setup_key_privacy")}
            </span>
          </p>

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
              {keySaved || localSaved ? (
                <>
                  {/* While the local models still download, the notice above
                      says so; "ready" would not be true yet. */}
                  {(keySaved || !waiting) && (
                    <div className={styles.ready} role="status">
                      <IconCircleCheckFilled size={20} aria-hidden="true" />
                      <span>
                        <strong>{t("setup_ready_title")}</strong>
                        {t("setup_key_saved", { model: setup.chat_model })}
                      </span>
                    </div>
                  )}
                  <button type="button" className={styles.primary} onClick={proceed}>
                    {t(signedIn ? "setup_open" : "setup_continue_sign_in")}
                    <IconArrowRight size={16} stroke={2} aria-hidden="true" />
                  </button>
                </>
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
                <>
                  {saving && mode === "key" && (
                    <p className={styles.wait} role="status">
                      {t("setup_checking_wait", { seconds: elapsed })}
                    </p>
                  )}
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
                </>
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

/**
 * A model's name beside a key. Editable where the deployment may change it,
 * read-only where .env sets it (which always wins) or the config names no
 * variable for it; the configured default is one click away.
 */
function ModelField({ id, label, field, value, onChange, hint, t }) {
  if (!modelDraft(field)) return null;
  const editable = modelEditable(field);
  const bad = editable && badModelName(value);
  return (
    <div className={styles.modelField}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <input
        id={id}
        className={styles.input}
        type="text"
        value={editable ? value : modelDraft(field)}
        readOnly={!editable}
        placeholder={field.default}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={bad || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
      {field.in_env_file && <small>{t("setup_model_in_env", { env: field.env })}</small>}
      {bad && <small className={styles.fieldError}>{t("setup_model_spaces")}</small>}
      {offersDefault(field, value) && (
        <button type="button" className={styles.reset} onClick={() => onChange(field.default)}>
          <IconRefresh size={13} stroke={1.8} aria-hidden="true" />
          {t("setup_model_reset", { model: field.default })}
        </button>
      )}
      {editable && hint && <small>{hint}</small>}
    </div>
  );
}

/** One local role's model, chosen from what the found server serves. */
function RoleSelect({ id, label, field, choices, value, onChange, t }) {
  if (!modelDraft(field)) return null;
  const editable = modelEditable(field);
  return (
    <div className={styles.modelField}>
      <label htmlFor={id} className={styles.fieldLabel}>
        {label}
      </label>
      <select
        id={id}
        className={cx(styles.input, styles.select)}
        value={editable ? value : field.model}
        disabled={!editable}
        onChange={(e) => onChange(e.target.value)}
      >
        {choices.map((c) => (
          <option key={c.id} value={c.id}>
            {c.served ? c.id : t("setup_option_not_served", { model: c.id })}
          </option>
        ))}
      </select>
      {field.in_env_file && <small>{t("setup_model_in_env", { env: field.env })}</small>}
    </div>
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

/** One size: what it runs, what it takes, and where that was measured. */
function TierCard({ tier, on, onServer, onSelect, t }) {
  const badge = tierBadge(tier.id);
  const hardware = tierHardware(tier.id);
  const download = oneDecimal(tier.download_gb);
  const memory = oneDecimal(tier.memory_gb);
  const answer = answerTime(tier.answer_s);
  // Null is unmeasured: said so, never filled with an estimate.
  const unmeasured = <span className={styles.unmeasured}>{t("setup_tier_unmeasured")}</span>;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={on}
      className={cx(styles.tier, on && styles.tierOn)}
      onClick={onSelect}
    >
      <span className={styles.tierHead}>
        <span className={styles.tierName}>{t(`setup_tier_name_${tier.id}`, { defaultValue: tier.id })}</span>
        {badge && <span className={styles.tierBadge}>{t(badge)}</span>}
      </span>
      <code className={styles.tierModels}>{tier.ocr ? `${tier.agent} + ${tier.ocr}` : tier.agent}</code>
      <span className={styles.tierFacts}>
        <TierFact label={t("setup_tier_download")}>{download ? `${download} GB` : unmeasured}</TierFact>
        <TierFact label={t("setup_tier_memory")}>{memory ? `${memory} GB` : unmeasured}</TierFact>
        <TierFact label={t("setup_tier_answer")}>
          {answer
            ? t(answer.unit === "min" ? "setup_tier_answer_min" : "setup_tier_answer_sec", { n: answer.n })
            : unmeasured}
        </TierFact>
        <TierFact label={t("setup_tier_photos")}>
          {t(tier.sees ? "setup_tier_sees" : "setup_tier_text_only")}
        </TierFact>
      </span>
      {(memory || answer) && tier.measured_on && (
        <span className={styles.tierMeasured}>{t("setup_tier_measured_on", { machine: tier.measured_on })}</span>
      )}
      {hardware && <span className={styles.tierHardware}>{t(hardware)}</span>}
      {onServer && (
        <span
          className={cx(
            styles.pill,
            onServer === "loaded" ? styles.pillOk : onServer === "unloaded" ? styles.pillWait : styles.pillMissing,
          )}
        >
          {t(`setup_tier_${onServer}`)}
        </span>
      )}
    </button>
  );
}

function TierFact({ label, children }) {
  return (
    <span className={styles.tierFact}>
      <span className={styles.tierFactLabel}>{label}</span>
      <span>{children}</span>
    </span>
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
