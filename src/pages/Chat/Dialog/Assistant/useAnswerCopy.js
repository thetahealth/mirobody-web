import { useEffect, useRef, useState } from "react";
import { answerText } from "./answerText";

export function useAnswerCopy(messages) {
  const text = answerText(messages);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copy = async () => {
    if (!text.trim()) return;
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(text);
      setCopyFailed(false);
      setCopied(true);
      timer.current = setTimeout(() => setCopied(false), 1400);
    } catch {
      setCopied(false);
      setCopyFailed(true);
    }
  };
  return { copy, copied, copyFailed, canCopy: Boolean(text.trim()) };
}
