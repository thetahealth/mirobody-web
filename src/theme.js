// AntD theme override — syncs the project design tokens (src/styles/tokens.css)
// into AntD. Injected globally via <ConfigProvider theme={antdTheme(dark)}> in
// main.jsx. The palette itself (navy on warm cream) is shared with the other
// Theta surfaces; tokens.css is the source of truth for both of its sides.
//
// These are literals, not var(--…): antd derives hover, active and border
// shades from each seed in JS, and a CSS variable is not a colour it can mix.
// So a value changed in tokens.css is changed here too, in the same commit.
import { theme } from "antd";

const LIGHT = {
  colorPrimary: "#0e3880",
  colorLink: "#0e3880",
  colorTextBase: "#1a1a1a",
  colorTextSecondary: "#5c5a57",
  colorTextTertiary: "#9b9894",
  colorBorder: "#e8e4dc",
  colorBorderSecondary: "#efece5",
  colorBgContainer: "#fbfaf7",
  colorBgLayout: "#f4f1ec",
  colorBgElevated: "#fbfaf7",
  colorSuccess: "#2f4a3a",
  colorWarning: "#c07a3a",
  colorError: "#b03a2e",
  colorInfo: "#3b6b9c",
  tableHeaderBg: "#efece5",
  tableHeaderColor: "#5c5a57",
  tableRowHoverBg: "#f4f1ec",
  textOnPrimary: "#ffffff",
};

// The dark side of tokens.css. colorPrimary is the light navy tone, so a
// primary button carries navy ink (colorTextLightSolid) rather than white.
const DARK = {
  colorPrimary: "#9db8ec",
  colorLink: "#9db8ec",
  colorTextBase: "#ece8e1",
  colorTextSecondary: "#b4afa7",
  colorTextTertiary: "#8a857e",
  colorBorder: "#34312d",
  colorBorderSecondary: "#2a2825",
  colorBgContainer: "#1c1b19",
  colorBgLayout: "#141311",
  colorBgElevated: "#252320",
  colorSuccess: "#8fbf9f",
  colorWarning: "#e0a36a",
  colorError: "#ec8a7f",
  colorInfo: "#8fb3da",
  tableHeaderBg: "#24221f",
  tableHeaderColor: "#b4afa7",
  tableRowHoverBg: "#252320",
  textOnPrimary: "#0d1e3a",
};

export const antdTheme = (dark) => {
  const c = dark ? DARK : LIGHT;
  return {
    algorithm: dark ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      colorPrimary: c.colorPrimary,
      colorLink: c.colorLink,
      colorTextBase: c.colorTextBase,
      colorTextSecondary: c.colorTextSecondary,
      colorTextTertiary: c.colorTextTertiary,
      colorTextLightSolid: c.textOnPrimary,
      colorBorder: c.colorBorder,
      colorBorderSecondary: c.colorBorderSecondary,
      colorBgContainer: c.colorBgContainer,
      colorBgLayout: c.colorBgLayout,
      colorBgElevated: c.colorBgElevated,
      colorSuccess: c.colorSuccess,
      colorWarning: c.colorWarning,
      colorError: c.colorError,
      colorInfo: c.colorInfo,

      // radii — kept in step with --radius-xs/sm/md
      borderRadius: 8,
      borderRadiusSM: 6,
      borderRadiusLG: 12,

      // fonts — kept in step with --font-sans (the self-hosted variable fonts)
      fontFamily:
        '"Source Sans 3 Variable", "Source Sans 3", -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Hiragino Sans GB", "Helvetica Neue", Arial, sans-serif',
    },
    components: {
      Table: {
        headerBg: c.tableHeaderBg,
        headerColor: c.tableHeaderColor,
        rowHoverBg: c.tableRowHoverBg,
      },
      Pagination: {
        itemActiveBg: c.colorBgContainer,
        itemActiveColorDisabled: c.colorTextTertiary,
      },
      Button: {
        primaryShadow: "none",
        defaultShadow: "none",
      },
    },
  };
};
