import { useEffect, useRef } from "react";
import { Popover } from "antd";
import { useTranslation } from "react-i18next";
import { useCitationStore } from "./store";
import { useCiteGroups } from "./context";
import { citeKind } from "./markup";
import { groupsOf } from "./anchors";
import { allGone } from "./sources";
import CiteSources from "./CiteSources";
import styles from "./index.module.scss";

/**
 * The words a cite group stands behind, with a dotted underline: a value
 * ("5.8 %") or, where the claim states none, the claim. Clicking opens every
 * source of the group, and every anchor of that group lights up while it is
 * open. Dotted, not solid: a solid underline in prose reads as a link that
 * leaves the page (NN/g), and this one opens in place.
 */
export default function CiteAnchor({ cite, kind, quote, at, children }) {
  const { t } = useTranslation();
  const ctx = useCiteGroups();
  const ref = useRef(null);
  const groups = groupsOf(cite);
  const ids = [...new Set(groups.flatMap((g) => ctx?.groups[g]?.ids || []))];
  const key = ids.join("|");
  const request = useCitationStore((s) => s.request);
  const resolved = useCitationStore((s) => s.resolved[ctx?.sessionId]);
  useEffect(() => {
    if (!ctx?.sessionId) return;
    for (const id of key.split("|")) {
      const kindOf = citeKind(id);
      if (kindOf === "row" || kindOf === "ref") request(ctx.sessionId, id);
    }
  }, [ctx?.sessionId, key, request]);

  if (!ctx) return children;
  const open = ctx.active?.at === at;
  const lit = Boolean(ctx.active?.groups.some((g) => groups.includes(g)));
  const show = () => ctx.open({ at, groups, ids, quote, el: ref.current });
  const className = [
    styles.anchor,
    kind === "value" ? styles.anchor_value : "",
    lit ? styles.anchor_on : "",
    allGone(ids, resolved) ? styles.anchor_gone : "",
  ].join(" ");

  const trigger = (
    <span
      ref={ref}
      className={className}
      role="button"
      tabIndex={0}
      aria-haspopup="dialog"
      aria-expanded={open}
      title={t("cite_sources_title")}
      // What it rests on, readable without opening it (tests, the README's
      // recorded walkthrough).
      data-cite-ids={ids.join(" ")}
      onClick={ctx.mobile ? show : undefined}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          if (open) ctx.close(at);
          else show();
        }
      }}
    >
      {children}
    </span>
  );
  if (ctx.mobile) return trigger;
  return (
    <Popover
      open={open}
      onOpenChange={(next) => (next ? show() : ctx.close(at))}
      trigger="click"
      placement="top"
      destroyOnHidden
      content={<CiteSources ids={ids} quote={quote} />}
    >
      {trigger}
    </Popover>
  );
}
