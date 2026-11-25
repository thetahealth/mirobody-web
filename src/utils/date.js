import dayjs from "dayjs";

/** Format a date shown in the UI without changing the ISO values sent to APIs. */
export const formatUiDate = (value, language = "en", { time = false, seconds = false } = {}) => {
  if (!value) return "";
  const isRussian = String(language).toLowerCase().startsWith("ru");
  const pattern = isRussian
    ? time
      ? seconds
        ? "DD.MM.YYYY HH:mm:ss"
        : "DD.MM.YYYY HH:mm"
      : "DD.MM.YYYY"
    : time
      ? seconds
        ? "YYYY-MM-DD HH:mm:ss"
        : "YYYY-MM-DD HH:mm"
      : "YYYY-MM-DD";
  return dayjs(value).format(pattern);
};
