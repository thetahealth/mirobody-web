import { useEffect } from "react";
import { Spin } from "antd";
import { CDM_URL } from "../../config/cdm";

// The developer / API-platform console lives in a separate app, when a
// deployment runs one (VITE_CDM_URL — see config/cdm.js). This route exists
// only to forward anyone who lands on /developer — a bookmark, a deep link, the
// nav fallback — over to it, carrying the session through the shared-domain
// cookie so they arrive signed in. With no URL configured the route is not
// reachable at all: the guard in router/ProtectedLayout.jsx sends it home.
export default function DeveloperRedirect() {
  useEffect(() => {
    // replace (not assign) so this dead /developer entry stays out of history —
    // the browser Back button returns to the page the user came from.
    window.location.replace(CDM_URL);
  }, []);

  return (
    <div className="flex items-center justify-center h-screen">
      <Spin size="large" />
    </div>
  );
}
