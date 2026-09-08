const QueryTitleRender = ({ content }) => {
  const safeContent =
    typeof content === "string" ? content : JSON.stringify(content);
  return (
    <div className="text-[var(--color-text-primary)] text-[14px] font-[500] flex-1 max-w-[434px] truncate w-fit">
      {safeContent}
    </div>
  );
};

export default QueryTitleRender;
