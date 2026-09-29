import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Popconfirm } from "antd";
import consola from "consola";
import api from "../../api";
import { linkDay, personLabel, splitLinks } from "./personalMcp.js";
import styles from "./SettingModal.module.scss";

// Above the Settings modal (z-index 9999), or the confirm opens behind it.
const POPUP_Z = 10000;

const isCancel = (error) => error?.name === "CanceledError" || error?.name === "AbortError";

// Settings → MCP. Mounted only while Settings is open (Modal renders nothing
// when closed), so a freshly made URL is dropped the moment Settings closes:
// the server cannot show it again, and neither should a stale page.
const PersonalMcpLinks = () => {
  const { t } = useTranslation();
  const [links, setLinks] = useState({ own: null, forOthers: [], holders: [] });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [minted, setMinted] = useState("");
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState("");
  const controllerRef = useRef(null);
  const copyTimeoutRef = useRef(null);

  const load = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    try {
      const listing = await api.listPersonalMcp(controller.signal);
      if (!controller.signal.aborted) setLinks(splitLinks(listing));
    } catch (e) {
      if (isCancel(e)) return;
      consola.error("ERROR: List personal MCP links", e);
      if (!controller.signal.aborted) setError(t("mcp_link_error"));
    } finally {
      if (!controller.signal.aborted) setLoaded(true);
    }
  }, [t]);

  useEffect(() => {
    load();
    return () => {
      controllerRef.current?.abort();
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
    };
  }, [load]);

  const run = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      if (!isCancel(e)) {
        consola.error("ERROR: Change personal MCP link", e);
        setError(t("mcp_link_error"));
      }
    } finally {
      setBusy(false);
    }
  };

  const create = () =>
    run(async () => {
      const { url } = await api.createPersonalMcp();
      setMinted(url || "");
      setIsCopied(false);
    });

  const revoke = (link) =>
    run(async () => {
      await api.revokePersonalMcp(link.id);
      if (link.own) setMinted("");
    });

  const copy = async () => {
    if (!minted) return;
    try {
      await navigator.clipboard.writeText(minted);
      setIsCopied(true);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 1500);
    } catch (e) {
      consola.error("ERROR: Copy MCP Url", e);
      setIsCopied(false);
    }
  };

  const confirm = (title, okText, onConfirm, child) => (
    <Popconfirm
      title={title}
      okText={okText}
      cancelText={t("cancel")}
      onConfirm={onConfirm}
      zIndex={POPUP_Z}
      disabled={busy}
    >
      {child}
    </Popconfirm>
  );

  const revokeButton = (link) =>
    confirm(
      t("mcp_link_revoke_confirm"),
      t("mcp_link_revoke"),
      () => revoke(link),
      <Button type="link" danger size="small" disabled={busy} style={{ padding: 0 }}>
        {t("mcp_link_revoke")}
      </Button>,
    );

  const lastUsed = (link) =>
    link.last_used_at ? t("mcp_link_last_used", { date: linkDay(link.last_used_at) }) : t("mcp_link_never_used");

  const { own, forOthers, holders } = links;

  return (
    <div className={styles.section}>
      <div className="flex items-center justify-between text-[16px] text-[var(--color-text-secondary)] font-[500] mb-2">
        <div>{t("mcp_link_title")}</div>
        {loaded && !own && (
          <Button type="link" onClick={create} disabled={busy} style={{ padding: 0 }}>
            {t("mcp_link_generate")}
          </Button>
        )}
      </div>
      {/* What this URL is FOR — without this line it reads as an opaque
          blob of secret, and nobody knows to paste it into an MCP client. */}
      <div className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed mb-2">
        {t("mcp_url_hint")}
      </div>

      {own && (
        <div className={styles.mcpLinkRow}>
          <div>
            <div>{t("mcp_link_expires", { date: linkDay(own.expires_at) })}</div>
            <div className={styles.mcpLinkMeta}>{lastUsed(own)}</div>
          </div>
          <div className="flex gap-3">
            {confirm(
              t("mcp_link_regenerate_confirm"),
              t("mcp_link_regenerate"),
              create,
              <Button type="link" size="small" disabled={busy} style={{ padding: 0 }}>
                {t("mcp_link_regenerate")}
              </Button>,
            )}
            {revokeButton(own)}
          </div>
        </div>
      )}
      {loaded && !own && !minted && <div className={styles.mcpLinkMeta}>{t("mcp_link_none")}</div>}

      {minted && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <div className="text-[12px] text-[var(--color-warning-text)]">{t("mcp_link_shown_once")}</div>
            {isCopied ? (
              <div className="text-green-500 text-sm">{t("copied")}</div>
            ) : (
              <Button type="link" onClick={copy} style={{ padding: 0 }}>
                {t("copy")}
              </Button>
            )}
          </div>
          <textarea className={styles.mcpUrlTextarea} value={minted} readOnly />
        </div>
      )}

      {error && <div className="text-red-500 text-sm mt-1">{error}</div>}

      {forOthers.length > 0 && (
        <>
          <div className={styles.mcpLinkSubtitle}>{t("mcp_link_made_for_others")}</div>
          {forOthers.map((link) => (
            <div key={link.id} className={styles.mcpLinkRow}>
              <div>
                <div>{t("mcp_link_for", { name: personLabel(link.subject_name, link.subject_id) })}</div>
                <div className={styles.mcpLinkMeta}>
                  {t("mcp_link_expires", { date: linkDay(link.expires_at) })} · {lastUsed(link)}
                </div>
              </div>
              {revokeButton(link)}
            </div>
          ))}
        </>
      )}

      <div className={styles.mcpLinkSubtitle}>{t("mcp_link_holders")}</div>
      {holders.length === 0 ? (
        loaded && <div className={styles.mcpLinkMeta}>{t("mcp_link_holders_none")}</div>
      ) : (
        holders.map((link) => (
          <div key={link.id} className={styles.mcpLinkRow}>
            <div>
              <div>{t("mcp_link_by", { name: personLabel(link.creator_name, link.creator_id) })}</div>
              <div className={styles.mcpLinkMeta}>
                {t("mcp_link_expires", { date: linkDay(link.expires_at) })} · {lastUsed(link)}
              </div>
            </div>
            {revokeButton(link)}
          </div>
        ))
      )}
    </div>
  );
};

export default PersonalMcpLinks;
