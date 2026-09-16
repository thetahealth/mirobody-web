// The question the user asked. Two caps matter here: a width, so a six-word
// question does not stretch into a 1360px banner across the whole content
// column; and a size at or below the answer's 16px, because the question used
// to be set at 18px — louder than the reply it was asking for.
const UserQuestion = ({ datasource }) => {
  return (
    <div
      dir="auto"
      className="flex max-w-[560px] p-[12px] bg-[var(--color-bg-soft)] rounded-[16px_16px_2px_16px] text-[var(--color-text-primary)] text-[15px] leading-relaxed break-words whitespace-pre-wrap"
    >
      {datasource.content || ""}
    </div>
  );
};

export default UserQuestion;
