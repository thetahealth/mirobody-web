import { useRouteError, isRouteErrorResponse, Link } from "react-router";
import consola from "consola";

// Route-level error boundary. Without it, any exception during render lands on
// React Router's default developer error page ("Unexpected Application Error!"
// plus a stack trace), which for a user is a broken page — the time SettingModal
// called a missing api.getPersonMcp, that page replaced the whole app.
//
// The copy here deliberately does NOT go through i18n: i18n initialisation is
// itself a possible source of the crash, so this page has to have no
// dependencies. It says everything in English and Chinese instead.
function RouteError() {
  const error = useRouteError();
  consola.error("Route error boundary:", error);

  const detail = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error instanceof Error
      ? error.message
      : String(error);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        gap: "12px",
        height: "100dvh",
        padding: "24px",
        textAlign: "center",
        fontFamily: "inherit",
      }}
    >
      <div style={{ fontSize: "20px", fontWeight: 600 }}>
        Something went wrong / 页面出错了
      </div>
      <div style={{ fontSize: "13px", color: "#888", maxWidth: "560px", overflowWrap: "anywhere" }}>
        {detail}
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{
            padding: "8px 20px",
            borderRadius: "8px",
            border: "1px solid #d9d9d9",
            background: "#fff",
            cursor: "pointer",
          }}
        >
          Reload / 刷新
        </button>
        <Link
          to="/"
          reloadDocument
          style={{
            padding: "8px 20px",
            borderRadius: "8px",
            border: "1px solid #d9d9d9",
            background: "#fff",
            color: "inherit",
            textDecoration: "none",
          }}
        >
          Home / 回首页
        </Link>
      </div>
    </div>
  );
}

export default RouteError;
