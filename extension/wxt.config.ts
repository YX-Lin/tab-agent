import { defineConfig } from "wxt";
import { PINNED_EXTENSION_KEY } from "@tab-title-agent/shared";

export default defineConfig({
  modules: ["@wxt-dev/module-react", "@wxt-dev/auto-icons"],
  srcDir: "src",
  autoIcons: {
    baseIconPath: "assets/icon.png",
    developmentIndicator: false,
  },
  manifest: {
    name: "Tab Agent",
    description: "整理 Chrome 标签：分组、改标题、对话管理。",
    version: "0.1.0",
    key: PINNED_EXTENSION_KEY,
    permissions: [
      "tabs",
      "tabGroups",
      "storage",
      "scripting",
      "sidePanel",
      "webNavigation",
      "contextMenus",
      "alarms",
      "nativeMessaging",
    ],
    host_permissions: ["<all_urls>"],
    action: {
      default_title: "打开 Tab Agent",
    },
    commands: {
      "rename-current-tab": {
        suggested_key: {
          default: "Alt+Shift+R",
        },
        description: "从工具栏弹出重命名当前标签",
      },
    },
  },
});
