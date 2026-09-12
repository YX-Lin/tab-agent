import {
  ROLE_LABELS,
  appendHabit,
  hostOf,
  originOf,
  pickRule,
  promoteHabits,
  renderTemplate,
  stripRolePrefix,
  urlKey,
  type HabitEvent,
  type OrganizeRule,
  type RoleId,
  type TabTitleOverride,
} from "@tab-title-agent/shared";
import {
  getActiveGroups,
  getBindings,
  getHabits,
  getOverrides,
  getRules,
  getSettings,
  getUndos,
  saveActiveGroups,
  saveHabits,
  saveOverrides,
  saveRules,
  saveUndos,
} from "./storage";
import { applyTitleToTab, getOverride, removeOverride, upsertOverride } from "./titles";

const applying = new Set<number>();

export async function recordHabit(event: HabitEvent) {
  const settings = await getSettings();
  if (!settings.habitLearning) return;
  const events = appendHabit(await getHabits(), event);
  await saveHabits(events);
  await maybePromote(events);
}

async function maybePromote(events: HabitEvent[]) {
  const rules = await getRules();
  const { rules: next, undos } = promoteHabits(events, rules);
  if (!undos.length) return;
  await saveRules(next);
  const existing = await getUndos();
  await saveUndos(
    [
      ...existing,
      ...undos.map((item) => ({
        at: Date.now(),
        summary: item.summary,
        previous: item.previous,
        next: item.next,
      })),
    ].slice(-20),
  );
}

export async function setTabTitle(options: {
  tabId: number;
  title: string;
  role?: RoleId;
  source: TabTitleOverride["source"];
  locked?: boolean;
  recordHabit?: boolean;
}) {
  const tab = await chrome.tabs.get(options.tabId);
  const previous = await getOverride(options.tabId);
  const originalTitle =
    previous?.originalTitle ?? stripRolePrefix(tab.title ?? "");
  const customTitle = options.title.trim();
  const override: TabTitleOverride = {
    tabId: options.tabId,
    urlKey: urlKey(tab.url),
    originalTitle,
    customTitle,
    role: options.role,
    source: options.source,
    sticky: options.locked === false ? "until-navigate" : "url-pattern",
    locked: options.locked ?? options.source === "manual",
  };
  await upsertOverride(override);
  const applied = await applyTitleToTab(options.tabId, customTitle);
  if (options.recordHabit && tab.url) {
    await recordHabit({
      at: Date.now(),
      host: hostOf(tab.url),
      action: options.role ? "set_role" : "set_title",
      role: options.role,
    });
  }
  return applied;
}

export async function restoreTabTitle(tabId: number) {
  const override = await getOverride(tabId);
  const tab = await chrome.tabs.get(tabId).catch(() => undefined);
  if (override) {
    await applyTitleToTab(tabId, override.originalTitle);
    await removeOverride(tabId);
  }
  if (tab?.url) {
    await recordHabit({
      at: Date.now(),
      host: hostOf(tab.url),
      action: "restore_title",
      role: override?.role,
    });
  }
}

export async function applyRulesToTab(tabId: number, force = false) {
  if (applying.has(tabId)) return;
  applying.add(tabId);
  try {
    const tab = await chrome.tabs.get(tabId).catch(() => undefined);
    if (!tab?.id || !tab.url || tab.url.startsWith("chrome://")) return;

    const override = await getOverride(tabId);
    if (override?.locked && !force) {
      if (override.urlKey === urlKey(tab.url)) {
        await applyTitleToTab(tabId, override.customTitle);
      } else {
        await removeOverride(tabId);
      }
      return;
    }

    const rules = await getRules();
    const pageTitle = override?.originalTitle ?? tab.title ?? "";
    const rule = pickRule(rules, { url: tab.url, title: pageTitle });
    if (!rule) return;

    if (rule.compiled.role && rule.compiled.template) {
      const title = renderTemplate(rule.compiled.template, {
        title: stripRolePrefix(pageTitle),
        url: tab.url,
        role: rule.compiled.role,
        index: tab.index,
      });
      await setTabTitle({
        tabId,
        title,
        role: rule.compiled.role,
        source: "rule",
        locked: false,
      });
    }

    if (rule.compiled.group === "active") {
      await moveToActiveGroup(tab);
    } else if (rule.compiled.group === "bound-origin") {
      await moveToBoundGroup(tab);
    }
  } finally {
    applying.delete(tabId);
  }
}

async function moveToActiveGroup(tab: chrome.tabs.Tab) {
  if (!tab.id || tab.groupId > 0) return;
  const active = await getActiveGroups();
  const groupId = active[String(tab.windowId)];
  if (!groupId) return;
  try {
    await chrome.tabs.group({ groupId, tabIds: tab.id });
  } catch {
    const next = { ...active };
    delete next[String(tab.windowId)];
    await saveActiveGroups(next);
  }
}

async function moveToBoundGroup(tab: chrome.tabs.Tab) {
  if (!tab.id || !tab.url) return;
  const origin = originOf(tab.url);
  const bindings = await getBindings();
  const binding = bindings.find((item) => item.origin === origin);
  if (!binding) return;
  const groups = await chrome.tabGroups.query({ windowId: tab.windowId });
  const group = groups.find((item) => item.title === binding.groupTitle);
  if (!group) return;
  await chrome.tabs.group({ groupId: group.id, tabIds: tab.id });
  if (binding.role) {
    const title = `[${ROLE_LABELS[binding.role]}] ${stripRolePrefix(tab.title ?? "")}`;
    await setTabTitle({
      tabId: tab.id,
      title,
      role: binding.role,
      source: "rule",
      locked: false,
    });
  }
}

export async function applyRulesToWindow(windowId?: number, force = false) {
  const tabs = await chrome.tabs.query(windowId ? { windowId } : { currentWindow: true });
  for (const tab of tabs) {
    if (tab.id) await applyRulesToTab(tab.id, force);
  }
}

export async function onTabRemoved(tabId: number) {
  const overrides = await getOverrides();
  delete overrides[String(tabId)];
  await saveOverrides(overrides);
}

export async function onTabUpdated(
  tabId: number,
  changeInfo: chrome.tabs.TabChangeInfo,
) {
  if (changeInfo.url) {
    await applyRulesToTab(tabId);
    return;
  }
  if (changeInfo.status === "complete") {
    await applyRulesToTab(tabId);
    return;
  }
  if (changeInfo.title) {
    const override = await getOverride(tabId);
    if (override && changeInfo.title !== override.customTitle) {
      await applyTitleToTab(tabId, override.customTitle);
    }
  }
}

export async function runPromoteHabits() {
  const events = await getHabits();
  await maybePromote(events);
  return getUndos();
}

export async function undoLearned() {
  const undos = await getUndos();
  const last = undos.at(-1);
  if (!last) return { ok: false, error: "没有可撤销的习惯规则" };
  const rules = await getRules();
  const next = last.previous
    ? rules.map((rule) => (rule.id === last.next.id ? last.previous! : rule))
    : rules.filter((rule) => rule.id !== last.next.id);
  await saveRules(next);
  await saveUndos(undos.slice(0, -1));
  return { ok: true, summary: last.summary };
}
