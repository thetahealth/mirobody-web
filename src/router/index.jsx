import { lazy } from "react";
import RootLayout from "./RootLayout.jsx";
import ProtectedLayout from "./ProtectedLayout.jsx";
import RouteError from "./RouteError.jsx";
import { LegacyChatRedirect, LegacyDriveRedirect } from "./LegacyRedirects.jsx";
import Landing from "./Landing.jsx";

// Lazy load all page components for code splitting
const Login = lazy(() => import("../pages/Login/index.jsx"));
const Chat = lazy(() => import("../pages/Chat/index.jsx"));
const Drive = lazy(() => import("../pages/Drive/index.jsx"));
const Share = lazy(() => import("../pages/Share/index.jsx"));
const Profile = lazy(() => import("../pages/Profile/index.jsx"));
const CareCircle = lazy(() => import("../pages/CareCircle/index.jsx"));
const Activate = lazy(() => import("../pages/Activate/index.jsx"));
const Indicators = lazy(() => import("../pages/Indicators/index.jsx"));
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
      // Public: the person opening an activation link has no account yet.
      {
        path: "/activate",
        Component: Activate,
      },
      {
        Component: ProtectedLayout,
        children: [
          {
            // 指标 is the landing page: it is the readings themselves, not the
            // files and devices they came from. Someone with no readings yet
            // lands on 数据 instead, where they can add some (Landing.jsx).
            index: true,
            Component: Landing,
          },
          {
            path: "/indicators",
            Component: Indicators,
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
          // 管理 — your own record, and everyone else's. Two nav items because
          // they are two different things (see config/navConfig.js).
          {
            path: "/profile",
            Component: Profile,
          },
          {
            path: "/care-circle",
            Component: CareCircle,
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
          // /home was this page's first shape (a data bar, an upload box and a
          // file list) before /data absorbed all three. Nothing has linked to it
          // for a long time; it stays as a redirect because bookmarks do not
          // know that.
          {
            path: "/home",
            Component: LegacyDriveRedirect,
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
