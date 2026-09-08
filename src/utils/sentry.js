import * as Sentry from "@sentry/react";
import React from "react";
import {
  createBrowserRouter as originalCreateBrowserRouter,
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from "react-router";
import { consola } from "consola";

const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN;
const SENTRY_ENV = import.meta.env.VITE_ENV;
// `|| ""` because a build with no .env at all would otherwise take the whole
// app down here, on a call to .includes of undefined, before anything renders.
const isProduction = (import.meta.env.VITE_ENV || "").includes("prod");

export const isSentryEnabled = !!SENTRY_DSN;

if (SENTRY_DSN) {
  const SENTRY_INTEGRATIONS = [
    Sentry.reactRouterV7BrowserTracingIntegration({
      useEffect: React.useEffect,
      useLocation,
      useNavigationType,
      createRoutesFromChildren,
      matchRoutes,
    }),
    Sentry.replayIntegration(),
  ];
  // Add feedback integration in non-production environments
  // autoInject: false - we use a custom draggable button component
  if (!isProduction) {
    SENTRY_INTEGRATIONS.push(
      Sentry.feedbackIntegration({
        colorScheme: "system",
        autoInject: false,
      }),
    );
  }

  const SENTRY_SAMPLE_RATES_CONFIG = {
    tracesSampleRate: isProduction ? 0.2 : 1.0,
    replaysSessionSampleRate: isProduction ? 0.01 : 0.1,
    replaysOnErrorSampleRate: 1.0,
  };

  try {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: SENTRY_ENV,
      sendDefaultPii: true,
      integrations: SENTRY_INTEGRATIONS,
      enableLogs: true,
      // Same-origin requests, plus the configured API host when the backend
      // lives on another origin. This used to be a hardcoded list of one
      // vendor's domains, which propagates nothing in any other deployment.
      tracePropagationTargets: (() => {
        const targets = [/^\//];
        const base = import.meta.env.VITE_BASE_URL_MCP;
        if (base) {
          try {
            targets.push(new URL(base).origin);
          } catch {
            // Relative base — the same-origin rule above already covers it.
          }
        }
        return targets;
      })(),
      ...SENTRY_SAMPLE_RATES_CONFIG,
    });

    // Add consola reporter for Sentry logging
    const sentryReporter = Sentry.createConsolaReporter({
      levels: ["error", "warn", "info", "debug", "trace"],
    });
    consola.addReporter(sentryReporter);
  } catch (error) {
    consola.error("Sentry: Failed to initialize", error);
  }
} else {
  // consola.info("Sentry: DSN not configured, skipping initialization");
}

// Export wrapped createBrowserRouter (after Sentry.init)
export const createBrowserRouter = isSentryEnabled
  ? Sentry.wrapCreateBrowserRouterV7(originalCreateBrowserRouter)
  : originalCreateBrowserRouter;
