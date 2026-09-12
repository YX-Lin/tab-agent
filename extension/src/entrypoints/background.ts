import { seedDefaults, STORAGE_KEYS } from "../lib/storage";
import { onTabRemoved, onTabUpdated, applyRulesToTab, applyRulesToWindow } from "../lib/organize";
import { openRenamePopover } from "../lib/rename-popover";
import { handleRequest } from "../lib/tools-runtime";
import { applyTitleToTab, getOverride } from "../lib/titles";
import { getMcpStatusWithSettings, syncMcpBridge } from "../lib/mcp-bridge";

const PAGE_CONTEXTS: chrome.contextMenus.ContextType[] = ["page", "action"];
const TAB_CONTEXTS = ["tab"] as chrome.contextMenus.ContextType[];

function createMenu(
  id: string,
  title: string,
  contexts: chrome.contextMenus.ContextType[],
) {
  chrome.contextMenus.create({ id, title, contexts }, () => {
    void chrome.runtime.lastError;
  });
}

function createContextMenus() {
  chrome.contextMenus.removeAll(() => {
    createMenu("rename-tab", "重命名此标签", PAGE_CONTEXTS);
    createMenu("organize-tab", "一键整理此标签", PAGE_CONTEXTS);
    createMenu("organize-window", "一键整理此窗口", PAGE_CONTEXTS);
    createMenu("rename-tab-strip", "重命名此标签", TAB_CONTEXTS);
    createMenu("organize-tab-strip", "一键整理此标签", TAB_CONTEXTS);
    createMenu("organize-window-strip", "一键整理此窗口", TAB_CONTEXTS);
  });
}

async function flashBadge() {
  await chrome.action.setBadgeBackgroundColor({ color: "#155eef" });
  await chrome.action.setBadgeText({ text: "OK" });
  setTimeout(() => {
    void chrome.action.setBadgeText({ text: "" });
  }, 1500);
}

async function organizeTab(tabId: number) {
  await applyRulesToTab(tabId, true);
  await flashBadge();
}

async function organizeWindow(windowId: number) {
  await applyRulesToWindow(windowId, true);
  await flashBadge();
}

export default defineBackground(() => {
  const setup = async () => {
    await seedDefaults();
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    createContextMenus();
    await syncMcpBridge();
  };

  void setup();

  chrome.runtime.onInstalled.addListener(() => {
    void setup();
  });

  chrome.runtime.onStartup?.addListener(() => {
    void seedDefaults();
    void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
    createContextMenus();
    void syncMcpBridge();
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "local" && changes[STORAGE_KEYS.settings]) {
      void syncMcpBridge();
    }
  });

  chrome.alarms.create("tab-agent-mcp", { periodInMinutes: 1 });
  chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === "tab-agent-mcp") void syncMcpBridge();
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const respond = async () => {
      if (message?.type === "CONTENT_READY" && sender.tab?.id != null) {
        const override = await getOverride(sender.tab.id);
        if (override) await applyTitleToTab(sender.tab.id, override.customTitle);
        else await applyRulesToTab(sender.tab.id);
        return { ok: true };
      }
      if (message?.type === "OPEN_RENAME" && typeof message.tabId === "number") {
        const target = await chrome.tabs.get(message.tabId);
        await openRenamePopover(target);
        return { ok: true };
      }
      if (message?.type === "GET_MCP_STATUS") {
        return getMcpStatusWithSettings();
      }
      return handleRequest(message);
    };
    void respond()
      .then(sendResponse)
      .catch((error: unknown) => {
        sendResponse({
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
    return true;
  });

  chrome.tabs.onRemoved.addListener((tabId) => {
    void onTabRemoved(tabId);
  });

  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    void onTabUpdated(tabId, changeInfo);
  });

  chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.frameId !== 0) return;
    void applyRulesToTab(details.tabId);
  });

  chrome.commands.onCommand.addListener(async (command, tab) => {
    if (command !== "rename-current-tab" || !tab?.id) return;
    await openRenamePopover(tab);
  });

  chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    const id = String(info.menuItemId);
    if ((id === "rename-tab" || id === "rename-tab-strip") && tab?.id) {
      await openRenamePopover(tab);
      return;
    }
    if ((id === "organize-tab" || id === "organize-tab-strip") && tab?.id) {
      await organizeTab(tab.id);
      return;
    }
    if ((id === "organize-window" || id === "organize-window-strip") && tab?.windowId != null) {
      await organizeWindow(tab.windowId);
    }
  });
});
