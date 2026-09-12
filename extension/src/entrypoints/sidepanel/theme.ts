import { theme, type ThemeConfig } from "antd";

export const appTheme: ThemeConfig = {
  algorithm: theme.compactAlgorithm,
  token: {
    colorPrimary: "#155eef",
    colorInfo: "#155eef",
    colorBgBase: "#eef1f6",
    colorBgContainer: "#ffffff",
    colorBgElevated: "#ffffff",
    colorBgLayout: "transparent",
    colorBorder: "rgba(15, 23, 42, 0.08)",
    colorBorderSecondary: "rgba(15, 23, 42, 0.06)",
    colorText: "#121826",
    colorTextSecondary: "#5c6578",
    colorTextTertiary: "#8b93a5",
    colorLink: "#155eef",
    borderRadius: 10,
    fontSize: 12,
    fontFamily:
      '"Segoe UI Variable Text", "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    controlHeight: 28,
    boxShadow: "none",
    boxShadowSecondary: "none",
  },
  components: {
    Button: {
      primaryShadow: "none",
      defaultShadow: "none",
    },
    Checkbox: {
      borderRadiusSM: 4,
    },
    Modal: {
      contentBg: "#ffffff",
      headerBg: "#ffffff",
    },
  },
};
