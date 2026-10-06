import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import styles from "./index.module.scss";
import { IconLink } from "@tabler/icons-react";
import VisChart from "../VisChart";
import { fenceClosed, normalizeChartFences } from "../VisChart/parseSource";

function Markdown({ content }) {
  const handleLinkClick = (href) => {
    window.open(href, "_blank");
  };
  // A chart fenced twice (```vis-chart then ```json) is collapsed first, or
  // its stray closer turns the rest of the answer into a code block.
  const source = normalizeChartFences(content);
  return (
    <div className={styles.prose}>
      <ReactMarkdown
        // cjk-friendly: CommonMark's emphasis delimiter rules treat
        // full-width punctuation as punctuation, so the ** in
        // `**基因位点（rsID）**数据` renders literally instead of as bold —
        // and models write exactly that in Chinese answers. This plugin
        // relaxes the delimiter test for CJK text.
        remarkPlugins={[remarkGfm, remarkCjkFriendly]}
        components={{
          // The glyph marks it as a link; the label says where it goes. Only
          // the glyph was rendered before, so every link in an answer was the
          // same anonymous 20x20 square.
          a: (props) => {
            const { href, children } = props;
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
  );
}

// memo: remark re-parses the whole string on every render. During streaming
// the store updates many times a second; memo confines the re-parse to the one
// message whose content actually changed instead of every message in the thread.
export default memo(Markdown);
