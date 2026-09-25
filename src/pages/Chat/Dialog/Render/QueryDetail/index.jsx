import styles from "./index.module.scss";
import { IconLink } from "@tabler/icons-react";

// URL regex pattern to match http/https links
const URL_REGEX = /https?:\/\/[^\s"\\]+/g;

const handleLinkClick = (href) => {
  window.open(href, "_blank");
};

/**
 * Parse text and replace URLs with clickable link icons
 * @param {string} text - The text to parse
 * @returns {React.ReactNode[]} - Array of text fragments and link icons
 */
const parseTextWithLinks = (text) => {
  if (!text) return null;
  if (typeof text !== "string") {
    try {
      return JSON.stringify(text, null, 2);
    } catch {
      return null;
    }
  }

  const parts = [];
  let lastIndex = 0;
  let match;

  // Reset regex lastIndex to ensure fresh matching
  URL_REGEX.lastIndex = 0;

  while ((match = URL_REGEX.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    // Add the link icon for the URL
    const url = match[0];
    parts.push(
      <span
        key={`link-${match.index}`}
        className={styles.link}
        onClick={() => handleLinkClick(url)}
        title={url}
      >
        <IconLink size={14} stroke={1.8} aria-hidden="true" />
      </span>,
    );

    lastIndex = match.index + url.length;
  }

  // Add remaining text after the last URL
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : text;
};

const QueryDetailRender = ({ content }) => {
  return (
    <div className={styles.query_detail_wrapper}>
      {parseTextWithLinks(content)}
    </div>
  );
};

export default QueryDetailRender;
