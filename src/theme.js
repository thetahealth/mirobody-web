// AntD theme override — syncs the project design tokens (src/styles/tokens.css)
// into AntD. Injected globally via <ConfigProvider theme={antdTheme}> in main.jsx.
// The palette itself (navy on warm cream) is shared with the other Theta
// surfaces; tokens.css is the source of truth for it.
export const antdTheme = {
  token: {
    // brand — navy accent
    colorPrimary: "#0e3880",
    colorLink: "#0e3880",

    // text
    colorTextBase: "#1a1a1a",
    colorTextSecondary: "#5c5a57",
    colorTextTertiary: "#9b9894",

    // borders
    colorBorder: "#e8e4dc",
    colorBorderSecondary: "#efece5",

    // surfaces
    colorBgContainer: "#fbfaf7",
    colorBgLayout: "#f4f1ec",
    colorBgElevated: "#fbfaf7",

    // semantic status
    colorSuccess: "#2f4a3a",
    colorWarning: "#c07a3a",
    colorError: "#b03a2e",
    colorInfo: "#3b6b9c",

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
      headerBg: "#efece5",
      headerColor: "#5c5a57",
      rowHoverBg: "#f4f1ec",
    },
    Pagination: {
      itemActiveBg: "#fbfaf7",
      itemActiveColorDisabled: "#9b9894",
    },
    Button: {
      primaryShadow: "none",
      defaultShadow: "none",
    },
  },
};
