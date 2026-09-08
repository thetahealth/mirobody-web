const UserQuestion = ({ datasource }) => {
  return (
    <div dir="auto" className="flex p-[12px] bg-[var(--color-bg-soft)] rounded-[16px_16px_2px_16px] text-[var(--color-text-primary)] text-[18px] break-words whitespace-normal">
      {datasource.content || ""}
    </div>
  );
};

export default UserQuestion;
