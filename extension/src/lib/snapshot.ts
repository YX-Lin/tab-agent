import {
  isRestrictedUrl,
  type GroupSnapshot,
  type TabSnapshot,
  type WindowSnapshot,
} from "@tab-title-agent/shared";
import { getActiveGroups, getOverrides } from "./storage";

export async function captureSnapshot(windowId?: number): Promise<WindowSnapshot> {
  const current =
    windowId ??
    (await chrome.windows.getLastFocused({ populate: false })).id ??
    (await chrome.tabs.query({ active: true, lastFocusedWindow: true }))[0]?.windowId;

  if (!current) {
    return {
      windowId: -1,
      focused: true,
      activeGroupId: null,
      groups: [],
      ungrouped: [],
      tabs: [],
    };
  }

  const [tabs, groups, overrides, activeMap] = await Promise.all([
    chrome.tabs.query({ windowId: current }),
    chrome.tabGroups.query({ windowId: current }),
    getOverrides(),
    getActiveGroups(),
  ]);

  const tabSnapshots: TabSnapshot[] = tabs.map((tab) => {
    const override = tab.id ? overrides[String(tab.id)] : undefined;
    return {
      id: tab.id ?? -1,
      windowId: tab.windowId,
      index: tab.index,
      url: tab.url ?? "",
      title: override?.customTitle ?? tab.title ?? "",
      originalTitle: override?.originalTitle ?? tab.title ?? "",
      customTitle: override?.customTitle,
      role: override?.role,
      locked: Boolean(override?.locked),
      pinned: Boolean(tab.pinned),
      active: Boolean(tab.active),
      favIconUrl: tab.favIconUrl,
      groupId: tab.groupId ?? -1,
      unsupported: isRestrictedUrl(tab.url),
    };
  });

  const activeGroupId = activeMap[String(current)] ?? null;
  const groupSnapshots: GroupSnapshot[] = groups.map((group) => ({
    id: group.id,
    windowId: group.windowId,
    title: group.title || "未命名分组",
    color: group.color,
    collapsed: group.collapsed,
    isActive: group.id === activeGroupId,
    tabIds: tabSnapshots.filter((tab) => tab.groupId === group.id).map((tab) => tab.id),
  }));

  return {
    windowId: current,
    focused: true,
    activeGroupId,
    groups: groupSnapshots,
    ungrouped: tabSnapshots.filter((tab) => tab.groupId < 0),
    tabs: tabSnapshots,
  };
}
