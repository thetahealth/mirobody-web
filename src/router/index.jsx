import { lazy } from "react";
import RootLayout from "./RootLayout.jsx";
import ProtectedLayout from "./ProtectedLayout.jsx";
import RouteError from "./RouteError.jsx";
import { LegacyChatRedirect, LegacyDriveRedirect } from "./LegacyRedirects.jsx";

// Lazy load all page components for code splitting
const Home = lazy(() => import("../pages/Home/index.jsx"));
const Login = lazy(() => import("../pages/Login/index.jsx"));
const Chat = lazy(() => import("../pages/Chat/index.jsx"));
const Drive = lazy(() => import("../pages/Drive/index.jsx"));
const Share = lazy(() => import("../pages/Share/index.jsx"));
const ChatList = lazy(() => import("../pages/Chat/ContentList/index.jsx"));
const ChatEmpty = lazy(() => import("../pages/Chat/EmptyContent/index.jsx"));
// /developer forwards to the cdm developer console (the page itself lives there now).
const DeveloperRedirect = lazy(() => import("../pages/Developer/index.jsx"));

export const routes = [
  {
    Component: RootLayout,
    ErrorBoundary: RouteError,
    children: [
      {
        path: "/login",
        Component: Login,
      },
      {
        path: "/mcplogin",
        Component: Login,
      },
      {
        path: "/share/:shareSessionId",
        Component: Share,
      },
      {
        Component: ProtectedLayout,
        children: [
          {
            index: true,
            Component: Drive,
          },
          {
            path: "/ask",
            Component: Chat,
            children: [
              {
                index: true,
                Component: ChatEmpty,
              },
              {
                path: ":sessionId",
                Component: ChatList,
              },
            ],
          },
          {
            path: "/data",
            Component: Drive,
          },
          // Legacy paths → the renamed ones.
          {
            path: "/chat",
            Component: LegacyChatRedirect,
          },
          {
            path: "/chat/:sessionId",
            Component: LegacyChatRedirect,
          },
          {
            path: "/drive",
            Component: LegacyDriveRedirect,
          },
          {
            path: "/home",
            Component: Home,
          },
          {
            path: "/developer",
            Component: DeveloperRedirect,
          },
        ],
      },
    ],
  },
];
