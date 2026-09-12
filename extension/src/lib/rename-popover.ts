import { setRenameRequest } from "./storage";

function renamePage(tabId: number) {
  return `rename.html?tabId=${tabId}`;
}

async function clearActionPopup() {
  await chrome.action.setPopup({ popup: "" });
}

async function openToolbarPopup(tab: chrome.tabs.Tab) {
  if (!tab.id) return false;
  const action = chrome.action as typeof chrome.action & {
    openPopup?: (options?: { windowId?: number }) => Promise<void>;
  };
  if (typeof action.openPopup !== "function") return false;

  await action.setPopup({ popup: renamePage(tab.id) });
  try {
    await action.openPopup(
      tab.windowId != null ? { windowId: tab.windowId } : undefined,
    );
    await new Promise((resolve) => setTimeout(resolve, 80));
    return true;
  } catch {
    return false;
  } finally {
    await clearActionPopup();
  }
}

async function openStandaloneWindow(tab: chrome.tabs.Tab) {
  if (!tab.id) return;
  const width = 360;
  const height = 460;
  const win = tab.windowId != null ? await chrome.windows.get(tab.windowId) : undefined;
  await chrome.windows.create({
    url: `${chrome.runtime.getURL("rename.html")}?tabId=${tab.id}`,
    type: "popup",
    focused: true,
    width,
    height,
    left:
      win?.left != null && win.width
        ? Math.round(win.left + (win.width - width) / 2)
        : undefined,
    top: win?.top != null ? win.top + 80 : undefined,
  });
}

export async function openRenamePopover(tab: chrome.tabs.Tab) {
  if (!tab.id || tab.windowId == null) return;

  if (await openToolbarPopup(tab)) return;

  try {
    await openStandaloneWindow(tab);
  } catch {
    await setRenameRequest(tab.id);
    await chrome.sidePanel.open({ windowId: tab.windowId });
  }
}
