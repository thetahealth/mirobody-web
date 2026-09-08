import Markdown from "../Markdown";

const ThinkingRender = ({ content }) => {
  const safeContent =
    typeof content === "string" ? content : JSON.stringify(content);
  return (
    <div className="text-[12px] text-[var(--color-text-secondary)]">
      <Markdown content={safeContent} />
    </div>
  );
};

export default ThinkingRender;
