import { useState, useEffect } from "react";
import { sessionManager } from "../utils/sessionManager";

/**
 * React hook that tracks whether a session re-auth is in progress.
 * Used by the Glass Pane overlay to block interaction during Touch ID.
 */
export const useSessionReauth = () => {
  const [isReauthing, setIsReauthing] = useState(false);

  useEffect(() => {
    return sessionManager.onReauthChange(setIsReauthing);
  }, []);

  return isReauthing;
};
