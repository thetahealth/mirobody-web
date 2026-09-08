import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import svgr from "vite-plugin-svgr";
import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync } from "fs";
import { sentryVitePlugin } from "@sentry/vite-plugin";
import { visualizer } from "rollup-plugin-visualizer";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Read package.json to get version
const packageJson = JSON.parse(
  readFileSync(path.resolve(__dirname, "package.json"), "utf-8"),
);
const appVersion = packageJson.version;

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load environment variables from .env files
  const env = loadEnv(mode, process.cwd(), "");

  // Feature flags from environment variables
  // process.env has higher priority than .env files
  const enableSentry = !!(
    process.env.SENTRY_AUTH_TOKEN || env.SENTRY_AUTH_TOKEN
  );

  // Get environment info
  const viteEnv = env.VITE_ENV || process.env.VITE_ENV || mode;
  const buildInfo = {
    version: appVersion,
    env: viteEnv,
  };

  // Log build info at build start
  console.info("=== Mirobody Web Build Version ===", buildInfo.version);
  console.info("=== Mirobody Web Build Environment ===", buildInfo.env);

  const plugins = [
    react({
      babel: {
        plugins: ["babel-plugin-react-compiler"],
      },
    }),
    legacy({
      targets: ["defaults", "not IE 11"],
    }),
    svgr(),
    tailwindcss(),
    // HTML injection plugin for build info
    {
      name: "html-build-info",
      transformIndexHtml(html) {
        // Inject meta tags in head
        const metaTags = `
    <meta name="app-version" content="${buildInfo.version}" />
    <meta name="app-env" content="${buildInfo.env}" />`;

        // Inject script before closing body tag
        const buildInfoScript = `
    <script>
      console.info('=== Mirobody Web Build Version ===', '${buildInfo.version}');
      console.info('=== Mirobody Web Build Environment ===', '${buildInfo.env}');
    </script>`;

        return html
          .replace(/<head>/, `<head>${metaTags}`)
          .replace("</body>", `${buildInfoScript}</body>`);
      },
    },
  ];

  // Conditionally add bundle analyzer
  const enableAnalyze = process.env.ANALYZE === "true";
  if (enableAnalyze) {
    plugins.push(
      visualizer({
        filename: "dist/stats.html",
        open: true,
        gzipSize: true,
        brotliSize: true,
      }),
    );
    console.info("✓ Bundle analyzer enabled");
  }

  // Conditionally add Sentry plugin
  if (enableSentry) {
    const sentryOrg = process.env.SENTRY_ORG || env.SENTRY_ORG;
    const sentryProject = process.env.SENTRY_PROJECT || env.SENTRY_PROJECT;
    const sentryAuthToken =
      process.env.SENTRY_AUTH_TOKEN || env.SENTRY_AUTH_TOKEN;

    plugins.push(
      sentryVitePlugin({
        org: sentryOrg,
        project: sentryProject,
        authToken: sentryAuthToken,
        sourcemaps: {
          filesToDeleteAfterUpload: ["./dist/**/*.map"],
        },
      }),
    );
    console.info(`✓ Sentry plugin enabled: ${sentryOrg}/${sentryProject}`);
  }

  return {
    plugins,
    // Vitest reads this `test` field from the Vite config. Scoped to the
    // pure helper unit tests (cdm codec / history fold+zip).
    test: {
      environment: "node",
      include: ["src/**/*.test.js"],
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "src"),
      },
    },

    css: {
      preprocessorOptions: {
        scss: {
          additionalData: `@use "@/styles/response.scss" as *;`,
        },
      },
    },

    server: {
      host: true,
      port: 5173,
      // Vite rejects requests whose Host header it does not know. localhost is
      // always allowed; add any other name you reach the dev server by
      // (comma-separated) — e.g. VITE_DEV_ALLOWED_HOSTS=dev.example.com
      allowedHosts: [
        "localhost",
        ...(env.VITE_DEV_ALLOWED_HOSTS || "")
          .split(",")
          .map((h) => h.trim())
          .filter(Boolean),
      ],
      // In development the app calls the API with relative paths (leave
      // VITE_BASE_URL_MCP empty) and this proxy forwards them to a backend on
      // another port, same-origin, so there is no CORS to configure. In
      // production the backend serves this bundle itself and none of this runs.
      //
      // 18060 is the port `./deploy.sh` publishes in the mirobody repo; point
      // VITE_DEV_PROXY_TARGET elsewhere if your backend listens somewhere else.
      proxy: (() => {
        const target = env.VITE_DEV_PROXY_TARGET || "http://localhost:18060";
        const opts = { target, changeOrigin: true, secure: false };
        return {
          "/v1": opts,
          "/api": opts,
          "/auth": opts,
          "/files": opts,
          "/invitation": opts,
          "/email": opts,
          "/google": opts,
          "/apple": opts,
          "/oauth": opts,
          "/personal": opts,
          "^/mirobody\\.json": opts,
          "/ws": { ...opts, ws: true },
        };
      })(),
    },

    build: {
      sourcemap: enableSentry,
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) {
              return;
            }

            // Firebase SDK - large, no React dependency
            if (id.includes("firebase") || id.includes("@firebase")) {
              return "vendor-firebase";
            }

            // Eruda - debug tool, dynamically loaded
            if (id.includes("eruda")) {
              return "vendor-eruda";
            }

            // Ant Design + its rc-* dependencies - keep together
            if (
              id.includes("antd") ||
              id.includes("@ant-design") ||
              id.includes("/rc-")
            ) {
              return "vendor-antd";
            }

            // Let Vite handle the rest automatically to avoid dependency issues
          },
        },
      },
    },
  };
});
