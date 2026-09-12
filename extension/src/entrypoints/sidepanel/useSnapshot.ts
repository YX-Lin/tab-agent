import { useCallback, useEffect, useState } from "react";
import type { ExtensionSettings, OrganizeRule, WindowSnapshot } from "@tab-title-agent/shared";
import { DEFAULT_SETTINGS } from "@tab-title-agent/shared";
import { send } from "../../lib/messages";
import { STORAGE_KEYS, type RenameRequest } from "../../lib/storage";

export function useSnapshot() {
  const [snapshot, setSnapshot] = useState<WindowSnapshot | null>(null);
  const [settings, setSettings] = useState<ExtensionSettings>(DEFAULT_SETTINGS);
  const [rules, setRules] = useState<OrganizeRule[]>([]);
  const [renameTabId, setRenameTabId] = useState<number | null>(null);
  const [undos, setUndos] = useState<{ summary: string }[]>([]);

  const refresh = useCallback(async () => {
    const [next, nextSettings, nextRules, insight] = await Promise.all([
      send<WindowSnapshot>({ type: "GET_SNAPSHOT" }),
      send<ExtensionSettings>({ type: "GET_SETTINGS" }),
      send<OrganizeRule[]>({ type: "GET_RULES" }),
      send<{ undos?: { summary: string }[] }>({ type: "CALL_TOOL", name: "list_habit_insights", args: {} }),
    ]);
    setSnapshot(next);
    setSettings(nextSettings);
    setRules(Array.isArray(nextRules) ? nextRules : []);
    setUndos(insight?.undos ?? []);
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    const onChanged = () => void refresh();
    chrome.storage.onChanged.addListener(onChanged);
    chrome.tabs.onActivated.addListener(onChanged);
    chrome.tabs.onUpdated.addListener(onChanged);
    chrome.tabGroups.onUpdated.addListener(onChanged);
    chrome.tabGroups.onCreated.addListener(onChanged);
    chrome.tabGroups.onRemoved.addListener(onChanged);
    return () => {
      clearInterval(timer);
      chrome.storage.onChanged.removeListener(onChanged);
      chrome.tabs.onActivated.removeListener(onChanged);
      chrome.tabs.onUpdated.removeListener(onChanged);
      chrome.tabGroups.onUpdated.removeListener(onChanged);
      chrome.tabGroups.onCreated.removeListener(onChanged);
      chrome.tabGroups.onRemoved.removeListener(onChanged);
    };
  }, [refresh]);

  useEffect(() => {
    const consume = async () => {
      const result = await chrome.storage.session.get(STORAGE_KEYS.rename);
      const request = result[STORAGE_KEYS.rename] as RenameRequest | undefined;
      if (request?.tabId) setRenameTabId(request.tabId);
    };
    void consume();
    const listener = (
      changes: { [key: string]: chrome.storage.StorageChange },
      area: string,
    ) => {
      if (area !== "session" || !changes[STORAGE_KEYS.rename]) return;
      const request = changes[STORAGE_KEYS.rename].newValue as RenameRequest | undefined;
      if (request?.tabId) setRenameTabId(request.tabId);
    };
    chrome.storage.onChanged.addListener(listener);
    return () => chrome.storage.onChanged.removeListener(listener);
  }, []);

  return {
    snapshot,
    settings,
    rules,
    undos,
    renameTabId,
    setRenameTabId,
    refresh,
  };
}
