import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";

/**
 * Full-screen Glass Pane overlay shown during session re-authentication.
 * Blocks all user interaction (pointer-events: all) and provides visual
 * feedback with a blur backdrop and spinner.
 */
const SessionReauthOverlay = () => {
  const { t } = useTranslation();
  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9998,
        backdropFilter: "blur(4px)",
        WebkitBackdropFilter: "blur(4px)",
        background: "rgba(255, 255, 255, 0.6)",
        pointerEvents: "all",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "12px",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          width: "32px",
          height: "32px",
          border: "3px solid var(--color-border)",
          borderTopColor: "var(--color-accent)",
          borderRadius: "50%",
          animation: "session-reauth-spin 0.8s linear infinite",
        }}
      />
      <span
        style={{
          color: "var(--color-text-secondary)",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        {t("session_verifying_identity")}
      </span>
      <style>{`
        @keyframes session-reauth-spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>,
    document.body,
  );
};

export default SessionReauthOverlay;
