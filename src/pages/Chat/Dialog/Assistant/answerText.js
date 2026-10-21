import { CHART_MESSAGE_TYPE } from "../../../../enum/chat";
import { stripCitations } from "../Render/Citations/markup";

// Answer-only consumers (clipboard, and eventually speech) share this boundary.
export const answerText = (messages = []) => messages
  .filter((message) => message.type === CHART_MESSAGE_TYPE.TEXT)
  .map((message) => stripCitations(message.text || ""))
  .filter(Boolean)
  .join("\n");
