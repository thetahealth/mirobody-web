import { Outlet, useLocation, useNavigate } from "react-router";
import { useSystemStore } from "../store/system";
import { useEffect, Suspense } from "react";
import { sendsToSetup, setupSkipped } from "../pages/Setup/setup.js";

// Loading fallback component for lazy loaded routes
function PageLoading() {
  return (
    <div
      style={{
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        height: "100dvh",
        width: "100vw",
      }}
    >
      <div
        style={{
          width: "40px",
          height: "40px",
          border: "3px solid #f3f3f3",
          borderTop: "3px solid #3498db",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

function RootLayout() {
  const initializeSystem = useSystemStore((state) => state.initializeSystem);
  const modelSetup = useSystemStore((state) => state.modelSetup);
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    initializeSystem();
  }, [initializeSystem]);

  // Here, not in ProtectedLayout: a new deployment has no account yet, and
  // the sign-in page is where it would otherwise stop. The setup page itself
  // works signed out.
  useEffect(() => {
    if (sendsToSetup({ modelSetup, pathname, skipped: setupSkipped() })) {
      navigate("/setup", { replace: true });
    }
  }, [modelSetup, pathname, navigate]);

  return (
    <Suspense fallback={<PageLoading />}>
      <Outlet />
    </Suspense>
  );
}

export default RootLayout;
