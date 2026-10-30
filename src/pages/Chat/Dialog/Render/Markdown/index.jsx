import { memo, useEffect, useState } from "react";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import { Drawer } from "antd";
import { useTranslation } from "react-i18next";
import styles from "./index.module.scss";
import citeStyles from "../Citations/index.module.scss";
import { IconLink } from "@tabler/icons-react";
import VisChart from "../VisChart";
import { fenceClosed, normalizeChartFences } from "../VisChart/parseSource";
import CiteAnchor from "../Citations/CiteAnchor";
import CiteSources from "../Citations/CiteSources";
import { CiteGroupsContext, useCitationSession } from "../Citations/context";
import { CITE_SCHEME, STATEMENT_SCHEME, prepareCitations, stripCitations } from "../Citations/markup";
import { rehypeCiteAnchors } from "../Citations/anchors";
import useIsMobile from "../../../../../hooks/useIsMobile";

// react-markdown drops a URL whose scheme it does not know; the markers are ours.
const urlTransform = (url) =>
  url.startsWith(CITE_SCHEME) || url.startsWith(STATEMENT_SCHEME) ? url : defaultUrlTransform(url);

const isMarker = (href) =>
  typeof href === "string" && (href.startsWith(CITE_SCHEME) || href.startsWith(STATEMENT_SCHEME));

// `cites`: draw this text's citations. Only an answer has them; a model's
// reasoning may spell out the markup while it plans, and a shared page has no
// sources a visitor could open, so both read as plain text.
function Markdown({ content, cites = false }) {
  const { t } = useTranslation();
  const sessionId = useCitationSession();
  const mobile = useIsMobile();
  const [active, setActive] = useState(null);
  const drawn = cites && Boolean(sessionId);
  const { markdown, groups } = drawn ? prepareCitations(content) : { markdown: stripCitations(content), groups: [] };

  // `at`: close only if that anchor is still the open one. Clicking a second
  // value closes the first and opens the second, in whichever order the
  // popovers report it.
  const close = (at) => setActive((current) => (!current || (at != null && current.at !== at) ? current : null));
  // Back to the value that opened it, so a keyboard reader keeps their place.
  const dismiss = () => {
    active?.el?.focus?.({ preventScroll: true });
    close();
  };

  // Escape closes the desktop popover; the phone's sheet handles its own.
  useEffect(() => {
    if (!active || mobile) return undefined;
    const onKey = (event) => {
      if (event.key !== "Escape") return;
      active.el?.focus?.({ preventScroll: true });
      setActive(null);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [active, mobile]);

  const handleLinkClick = (href) => {
    window.open(href, "_blank");
  };
  // A chart fenced twice (```vis-chart then ```json) is collapsed first, or
  // its stray closer turns the rest of the answer into a code block.
  const source = normalizeChartFences(markdown);
  return (
    <CiteGroupsContext.Provider
      value={drawn ? { groups, sessionId, mobile, active, open: setActive, close } : null}
    >
      <div className={styles.prose}>
        <ReactMarkdown
          // cjk-friendly: CommonMark's emphasis delimiter rules treat
          // full-width punctuation as punctuation, so the ** in
          // `**基因位点（rsID）**数据` renders literally instead of as bold —
          // and models write exactly that in Chinese answers. This plugin
          // relaxes the delimiter test for CJK text.
          remarkPlugins={[remarkGfm, remarkCjkFriendly]}
          rehypePlugins={groups.length ? [[rehypeCiteAnchors, { groups }]] : []}
          urlTransform={urlTransform}
          components={{
            // The glyph marks it as a link; the label says where it goes. Only
            // the glyph was rendered before, so every link in an answer was the
            // same anonymous 20x20 square.
            a: (props) => {
              const { href, children } = props;
              if (isMarker(href)) return null;
              return (
                <span
                  className={styles.link}
                  role="link"
                  tabIndex={0}
                  onClick={() => handleLinkClick(href)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      handleLinkClick(href);
                    }
                  }}
                >
                  <IconLink size={14} stroke={1.8} aria-hidden="true" />
                  {children}
                </span>
              );
            },
            span: (props) => {
              const { node: _node, children, ...rest } = props;
              const cite = rest["data-cite"];
              if (cite == null) return <span {...rest}>{children}</span>;
              return (
                <CiteAnchor cite={cite} kind={rest["data-cite-kind"]} quote={rest["data-cite-quote"]} at={rest["data-cite-at"]}>
                  {children}
                </CiteAnchor>
              );
            },
            // Fenced code: language-vis-chart renders a chart, everything
            // else stays a code block. `node.position` spans the whole fenced
            // block in `source`, closing fence included once it has streamed in.
            code(props) {
              const { className = "", children, ...rest } = props;
              if (className.includes("language-vis-chart")) {
                const at = props.node?.position;
                const raw = at ? source.slice(at.start.offset, at.end.offset) : "";
                return <VisChart source={String(children)} complete={fenceClosed(raw)} />;
              }
              return (
                <code className={className} {...rest}>
                  {children}
                </code>
              );
            },
            // Strip the code-block background and padding off the <pre> that
            // wraps a vis-chart, so the chart is not framed like source code.
            pre(props) {
              const cls = props.node?.children?.[0]?.properties?.className;
              if (Array.isArray(cls) && cls.includes("language-vis-chart")) {
                return <>{props.children}</>;
              }
              return <pre {...props} />;
            },
          }}
        >
          {source}
        </ReactMarkdown>
      </div>
      {drawn && mobile ? (
        <Drawer
          placement="bottom"
          open={Boolean(active)}
          onClose={dismiss}
          title={t("cite_sources_title")}
          size={Math.round(window.innerHeight * 0.6)}
          className={citeStyles.sheet}
          destroyOnHidden
        >
          {active ? <CiteSources ids={active.ids} quote={active.quote} /> : null}
        </Drawer>
      ) : null}
    </CiteGroupsContext.Provider>
  );
}

// memo: remark re-parses the whole string on every render. During streaming
// the store updates many times a second; memo confines the re-parse to the one
// message whose content actually changed instead of every message in the thread.
export default memo(Markdown);
