import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkCjkFriendly from "remark-cjk-friendly";
import styles from "./index.module.scss";
import MarkdownLinkSVG from "../../../../../assets/md-link.svg?react";
import VisChart from "../VisChart";

function Markdown({ content }) {
  const handleLinkClick = (href) => {
    window.open(href, "_blank");
  };
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
          a: (props) => {
            const { href } = props;
            return (
              <span
                className={styles.link}
                onClick={() => handleLinkClick(href)}
              >
                <MarkdownLinkSVG
                  style={{
                    verticalAlign: "middle",
                    display: "inline-block",
                  }}
                />
              </span>
            );
          },
          // Fenced code: language-vis-chart renders a chart, everything
          // else stays a code block.
          code(props) {
            const { className = "", children, ...rest } = props;
            if (className.includes("language-vis-chart")) {
              return <VisChart source={String(children)} />;
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
        {content}
      </ReactMarkdown>
    </div>
  );
}

// memo: remark re-parses the whole string on every render. During streaming
// the store updates many times a second; memo confines the re-parse to the one
// message whose content actually changed instead of every message in the thread.
export default memo(Markdown);
