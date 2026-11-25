const PLAIN_NUMBER = /^([+\-−]?)(\d+)(?:\.(\d+))?$/;

/** Localize a plain number for display while leaving clinical text untouched. */
export const formatUiNumber = (value, language = "en") => {
  const text = String(value ?? "");
  if (!String(language).toLowerCase().startsWith("ru")) return text;

  const match = PLAIN_NUMBER.exec(text.trim());
  if (!match) return text;
  const [, sign, , fraction = ""] = match;
  const numeric = Number(text.trim().replace("−", "-"));
  const formatted = new Intl.NumberFormat("ru-RU", {
    minimumFractionDigits: fraction.length,
    maximumFractionDigits: fraction.length,
  }).format(numeric);
  return sign === "+" ? `+${formatted}` : formatted;
};
