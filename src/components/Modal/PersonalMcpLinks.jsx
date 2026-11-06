import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Popconfirm } from "antd";
import consola from "consola";
import api from "../../api";
import { useAccountStore } from "../../store/account";
import { linkDay, linkRows, personLabel, splitLinks } from "./personalMcp.js";
import styles from "./SettingModal.module.scss";

// Above the Settings modal (z-index 9999), or the confirm opens behind it.
const POPUP_Z = 10000;

const isCancel = (error) => error?.name === "CanceledError" || error?.name === "AbortError";

// Settings → MCP. Mounted only while Settings is open (Modal renders nothing
// when closed), so a freshly made URL is dropped the moment Settings closes:
// the server cannot show it again, and neither should a stale page.
const PersonalMcpLinks = () => {
  const { t } = useTranslation();
  const roster = useAccountStore((state) => state.beneficiary_users);
  const fetchBeneficiaryUsers = useAccountStore((state) => state.fetchBeneficiaryUsers);
  const [links, setLinks] = useState({ own: null, forOthers: [], holders: [] });
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(false);
  // Row key → the URL made for that record while Settings has been open. One
  // per record, so a link made for a parent and one for oneself can both be
  // copied before Settings closes; each sits under the row it reads.
  const [minted, setMinted] = useState({});
  const [copiedKey, setCopiedKey] = useState("");
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

  // The member rows come from the roster the record switcher uses. Settings
  // can open on a page that never loaded it, or before a member added
  // elsewhere reached it, so ask again rather than offer a stale list.
  useEffect(() => {
    fetchBeneficiaryUsers();
  }, [fetchBeneficiaryUsers]);

  const rows = useMemo(() => linkRows(links, roster), [links, roster]);

  const run = async (action, refusedMessage) => {
    setBusy(true);
    setError("");
    try {
      await action();
      await load();
    } catch (e) {
      if (!isCancel(e)) {
        consola.error("ERROR: Change personal MCP link", e);
        const refused = e?.response?.status === 403 && refusedMessage;
        setError(refused ? refusedMessage : t("mcp_link_error"));
        if (refused) {
          // The care circle no longer lets the caller read this record: the
          // roster on screen is older than the server's answer, and stopping
          // the share already revoked the old link. Show what is true now.
          fetchBeneficiaryUsers();
          await load();
        }
      }
    } finally {
      setBusy(false);
    }
  };

  const create = (row) =>
    run(
      async () => {
        const { url } = await api.createPersonalMcp(row.own ? undefined : row.subjectId);
        setMinted((prev) => ({ ...prev, [row.key]: url || "" }));
        setCopiedKey("");
      },
      row.own ? "" : t("mcp_link_refused", { name: row.name }),
    );

  const revoke = (link, rowKey) =>
    run(async () => {
      await api.revokePersonalMcp(link.id);
      if (rowKey) {
        setMinted((prev) => {
          const next = { ...prev };
          delete next[rowKey];
          return next;
        });
      }
    });

  const copy = async (key) => {
    const url = minted[key];
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedKey(key);
      if (copyTimeoutRef.current) clearTimeout(copyTimeoutRef.current);
      copyTimeoutRef.current = setTimeout(() => setCopiedKey(""), 1500);
    } catch (e) {
      consola.error("ERROR: Copy MCP Url", e);
      setCopiedKey("");
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

  const revokeButton = (link, rowKey) =>
    confirm(
      t("mcp_link_revoke_confirm"),
      t("mcp_link_revoke"),
      () => revoke(link, rowKey),
      <Button type="link" danger size="small" disabled={busy} style={{ padding: 0 }}>
        {t("mcp_link_revoke")}
      </Button>,
    );

  const lastUsed = (link) =>
    link.last_used_at ? t("mcp_link_last_used", { date: linkDay(link.last_used_at) }) : t("mcp_link_never_used");

  const rowActions = (row) => {
    if (!row.link) {
      return (
        row.canMint && (
          <Button type="link" size="small" onClick={() => create(row)} disabled={busy || !loaded} style={{ padding: 0 }}>
            {t("mcp_link_generate")}
          </Button>
        )
      );
    }
    return (
      <>
        {row.canMint &&
          confirm(
            t("mcp_link_regenerate_confirm"),
            t("mcp_link_regenerate"),
            () => create(row),
            <Button type="link" size="small" disabled={busy} style={{ padding: 0 }}>
              {t("mcp_link_regenerate")}
            </Button>,
          )}
        {revokeButton(row.link, row.key)}
      </>
    );
  };

  const { holders } = links;
  const hasMembers = rows.length > 1;

  return (
    <div className={styles.section}>
      <div className="text-[16px] text-[var(--color-text-secondary)] font-[500] mb-2">{t("mcp_link_title")}</div>
      {/* What this URL is FOR — without this line it reads as an opaque
          blob of secret, and nobody knows to paste it into an MCP client. */}
      <div className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed mb-2">
        {t("mcp_url_hint")}
      </div>
      {/* One URL reads one record, on purpose: a client holding Mom's link
          cannot wander into anyone else's. Said here because the person who
          asked (#232) expected one link to reach every record they manage. */}
      {hasMembers && (
        <div className="text-[12px] text-[var(--color-text-secondary)] leading-relaxed mb-2">
          {t("mcp_link_per_record_hint")}
        </div>
      )}

      {rows.map((row) => (
        // Rows and the holders below share one parent: a member id and a
        // link id are both small integers, so each list keys its own way.
        <div key={`person-${row.key}`} className={styles.mcpLinkItem}>
          <div className={styles.mcpLinkRow}>
            <div className={styles.mcpLinkWho}>
              <div className={styles.mcpLinkName}>
                {row.own ? t("mcp_link_record_mine") : t("mcp_link_record_of", { name: row.name })}
              </div>
              <div className={styles.mcpLinkMeta}>
                {row.link
                  ? `${t("mcp_link_expires", { date: linkDay(row.link.expires_at) })} · ${lastUsed(row.link)}`
                  : loaded && t("mcp_link_none")}
              </div>
            </div>
            <div className={styles.mcpLinkActions}>{rowActions(row)}</div>
          </div>
          {minted[row.key] && (
            <div className="mt-2">
              <div className="flex items-center justify-between gap-3 mb-1">
                <div className="text-[12px] text-[var(--color-warning-text)]">{t("mcp_link_shown_once")}</div>
                {copiedKey === row.key ? (
                  <div className="text-green-500 text-sm shrink-0">{t("copied")}</div>
                ) : (
                  <Button type="link" onClick={() => copy(row.key)} style={{ padding: 0 }}>
                    {t("copy")}
                  </Button>
                )}
              </div>
              <textarea className={styles.mcpUrlTextarea} value={minted[row.key]} readOnly />
            </div>
          )}
        </div>
      ))}

      {error && <div className="text-red-500 text-sm mt-1">{error}</div>}

      <div className={styles.mcpLinkSubtitle}>{t("mcp_link_holders")}</div>
      {holders.length === 0 ? (
        loaded && <div className={styles.mcpLinkMeta}>{t("mcp_link_holders_none")}</div>
      ) : (
        holders.map((link) => (
          <div key={`holder-${link.id}`} className={styles.mcpLinkItem}>
            <div className={styles.mcpLinkRow}>
              <div className={styles.mcpLinkWho}>
                <div>{t("mcp_link_by", { name: personLabel(link.creator_name, link.creator_id) })}</div>
                <div className={styles.mcpLinkMeta}>
                  {t("mcp_link_expires", { date: linkDay(link.expires_at) })} · {lastUsed(link)}
                </div>
              </div>
              <div className={styles.mcpLinkActions}>{revokeButton(link)}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
};

export default PersonalMcpLinks;
