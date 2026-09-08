import { Outlet } from "react-router";
import { useSystemStore } from "../store/system";
import { useEffect, Suspense } from "react";

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

  useEffect(() => {
    initializeSystem();
  }, [initializeSystem]);

  return (
    <Suspense fallback={<PageLoading />}>
      <Outlet />
    </Suspense>
  );
}

export default RootLayout;
