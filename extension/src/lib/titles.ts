import {
  isRestrictedUrl,
  urlKey,
  type TabTitleOverride,
} from "@tab-title-agent/shared";
import { getOverrides, saveOverrides } from "./storage";

export function overrideKey(tabId: number) {
  return String(tabId);
}

export async function getOverride(tabId: number) {
  const overrides = await getOverrides();
  return overrides[overrideKey(tabId)];
}

export async function upsertOverride(override: TabTitleOverride) {
  const overrides = await getOverrides();
  overrides[overrideKey(override.tabId)] = override;
  await saveOverrides(overrides);
}

export async function removeOverride(tabId: number) {
  const overrides = await getOverrides();
  delete overrides[overrideKey(tabId)];
  await saveOverrides(overrides);
}

export async function applyTitleToTab(
  tabId: number,
  title: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (!tab?.url || isRestrictedUrl(tab.url)) {
    return { ok: false, error: "unsupported_page" };
  }

  try {
    await chrome.tabs.sendMessage(tabId, { type: "APPLY_TITLE", title });
    return { ok: true };
  } catch {
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: (nextTitle: string) => {
          document.title = nextTitle;
        },
        args: [title],
      });
      return { ok: true };
    } catch {
      return { ok: false, error: "unsupported_page" };
    }
  }
}

export async function readPageTitle(tabId: number): Promise<string | undefined> {
  try {
    const [result] = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => document.title,
    });
    return typeof result?.result === "string" ? result.result : undefined;
  } catch {
    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    return tab?.title;
  }
}

export function shouldKeepOverride(
  override: TabTitleOverride,
  nextUrl: string | undefined,
) {
  if (!nextUrl) return true;
  if (override.sticky === "until-closed") return true;
  if (override.sticky === "url-pattern") return override.urlKey === urlKey(nextUrl);
  return false;
}
