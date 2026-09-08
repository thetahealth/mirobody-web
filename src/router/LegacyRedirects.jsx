import { Navigate, useParams } from "react-router";

// The nav has always said Data / Ask while the URLs said /drive /chat — two
// names for the same two pages. The URLs now match the nav; the old paths
// stay as redirects because they live in bookmarks and chat-history links.
// (Separate file because router/index.jsx exports the route table, and
// react-refresh requires component files to export only components.)

export const LegacyChatRedirect = () => {
  const { sessionId } = useParams();
  return <Navigate to={sessionId ? `/ask/${sessionId}` : "/ask"} replace />;
};

export const LegacyDriveRedirect = () => <Navigate to="/data" replace />;
