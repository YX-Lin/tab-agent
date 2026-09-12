import {
  compileUtterance,
  hostOf,
  isRoleId,
  originOf,
  renderTemplate,
  ruleMatches,
  stripRolePrefix,
  type OrganizeRule,
} from "@tab-title-agent/shared";
import {
  getActiveGroups,
  getBindings,
  getHabits,
  getRules,
  getSettings,
  getUndos,
  normalizeSettings,
  saveActiveGroups,
  saveBindings,
  saveRules,
  saveSettings,
} from "./storage";
import {
  applyRulesToTab,
  applyRulesToWindow,
  restoreTabTitle,
  runPromoteHabits,
  setTabTitle,
  undoLearned,
  recordHabit,
} from "./organize";
import { captureSnapshot } from "./snapshot";

export async function callTool(
  name: string,
  args: Record<string, unknown>,
  ctx?: { source?: "rule" | "chat" | "mcp" | "manual" },
) {
  switch (name) {
    case "list_tabs": {
      const snapshot = await captureSnapshot();
      return snapshot.tabs;
    }
    case "list_groups": {
      const snapshot = await captureSnapshot();
      return snapshot.groups;
    }
    case "set_tab_title": {
      const tabId = Number(args.tabId);
      const title = String(args.title ?? "");
      const role = typeof args.role === "string" && isRoleId(args.role) ? args.role : undefined;
      return setTabTitle({
        tabId,
        title,
        role,
        source: ctx?.source ?? "chat",
        locked: true,
        recordHabit: true,
      });
    }
    case "restore_tab_title":
      await restoreTabTitle(Number(args.tabId));
      return { ok: true };
    case "create_group": {
      const title = String(args.title ?? "未命名分组");
      const tabIds = Array.isArray(args.tabIds) ? args.tabIds.map(Number) : [];
      if (!tabIds.length) return { ok: false, error: "需要至少一个 tabId" };
      const groupId = await chrome.tabs.group({ tabIds });
      await chrome.tabGroups.update(groupId, { title });
      const tab = await chrome.tabs.get(tabIds[0]);
      const active = await getActiveGroups();
      active[String(tab.windowId)] = groupId;
      await saveActiveGroups(active);
      return { ok: true, groupId };
    }
    case "rename_group": {
      await chrome.tabGroups.update(Number(args.groupId), {
        title: String(args.title ?? ""),
      });
      return { ok: true };
    }
    case "set_active_workstream": {
      const group = await chrome.tabGroups.get(Number(args.groupId));
      const active = await getActiveGroups();
      active[String(group.windowId)] = group.id;
      await saveActiveGroups(active);
      await chrome.tabGroups.update(group.id, { collapsed: false });
      return { ok: true };
    }
    case "move_tabs_to_group": {
      const tabIds = Array.isArray(args.tabIds) ? args.tabIds.map(Number) : [];
      const groupId = Number(args.groupId);
      await chrome.tabs.group({ tabIds, groupId });
      if (args.recordHabit !== false) {
        const group = await chrome.tabGroups.get(groupId);
        const active = await getActiveGroups();
        for (const tabId of tabIds) {
          const tab = await chrome.tabs.get(tabId);
          await recordHabit({
            at: Date.now(),
            host: hostOf(tab.url),
            action: "move_to_group",
            groupName: group.title,
            activeGroup: active[String(tab.windowId)] === groupId,
          });
        }
      }
      return { ok: true };
    }
    case "ungroup_tabs": {
      const tabIds = Array.isArray(args.tabIds) ? args.tabIds.map(Number) : [];
      await chrome.tabs.ungroup(tabIds);
      for (const tabId of tabIds) {
        const tab = await chrome.tabs.get(tabId).catch(() => undefined);
        if (tab?.url) {
          await recordHabit({
            at: Date.now(),
            host: hostOf(tab.url),
            action: "ungroup",
          });
        }
      }
      return { ok: true };
    }
    case "bind_origin_to_workstream": {
      const group = await chrome.tabGroups.get(Number(args.groupId));
      const bindings = await getBindings();
      const origin = String(args.origin ?? "");
      const role = typeof args.role === "string" && isRoleId(args.role) ? args.role : undefined;
      const next = bindings.filter((item) => item.origin !== origin);
      next.push({ origin, groupTitle: group.title || "", role });
      await saveBindings(next);
      return { ok: true };
    }
    case "compile_rule":
      return compileUtterance(String(args.utterance ?? ""));
    case "preview_rule": {
      const snapshot = await captureSnapshot();
      let rule: OrganizeRule | undefined;
      if (typeof args.ruleId === "string") {
        rule = (await getRules()).find((item) => item.id === args.ruleId);
      } else if (typeof args.utterance === "string") {
        const compiled = compileUtterance(args.utterance);
        if (!compiled.ok) return compiled;
        rule = compiled.rule;
      }
      if (!rule) return { ok: false, error: "没有可预览的规则" };
      return snapshot.tabs
        .filter((tab) => ruleMatches(rule, { url: tab.url, title: tab.originalTitle }))
        .map((tab) => ({
          tabId: tab.id,
          from: tab.title,
          to: rule.compiled.template
            ? renderTemplate(rule.compiled.template, {
                title: stripRolePrefix(tab.originalTitle),
                url: tab.url,
                role: rule.compiled.role,
                index: tab.index,
              })
            : tab.title,
          role: rule.compiled.role,
        }));
    }
    case "upsert_rule": {
      const rule = args.rule as OrganizeRule;
      const rules = await getRules();
      const index = rules.findIndex((item) => item.id === rule.id);
      if (index >= 0) rules[index] = rule;
      else rules.push(rule);
      await saveRules(rules);
      return { ok: true, rule };
    }
    case "delete_rule": {
      const rules = await getRules();
      await saveRules(rules.filter((item) => item.id !== args.id));
      return { ok: true };
    }
    case "apply_rules": {
      await applyRulesToWindow();
      return { ok: true };
    }
    case "promote_habits":
      return { ok: true, undos: await runPromoteHabits() };
    case "undo_learned_rule":
      return undoLearned();
    case "list_habit_insights":
      return {
        events: (await getHabits()).slice(-30),
        undos: await getUndos(),
        rules: (await getRules()).filter((rule) => rule.source === "learned"),
      };
    default:
      return { ok: false, error: `未知工具 ${name}` };
  }
}

export async function handleRequest(message: { type: string; [key: string]: unknown }) {
  switch (message.type) {
    case "GET_SNAPSHOT":
      return captureSnapshot(
        typeof message.windowId === "number" ? message.windowId : undefined,
      );
    case "SET_TITLE":
      return setTabTitle({
        tabId: Number(message.tabId),
        title: String(message.title ?? ""),
        role: typeof message.role === "string" && isRoleId(message.role) ? message.role : undefined,
        source: "manual",
        locked: true,
        recordHabit: message.recordHabit !== false,
      });
    case "RESTORE_TITLE":
      await restoreTabTitle(Number(message.tabId));
      return { ok: true };
    case "CREATE_GROUP":
      return callTool("create_group", message);
    case "RENAME_GROUP":
      return callTool("rename_group", message);
    case "SET_ACTIVE": {
      const windowId = Number(message.windowId);
      const groupId = message.groupId == null ? null : Number(message.groupId);
      const active = await getActiveGroups();
      if (groupId == null) delete active[String(windowId)];
      else active[String(windowId)] = groupId;
      await saveActiveGroups(active);
      if (groupId != null) await chrome.tabGroups.update(groupId, { collapsed: false });
      return { ok: true };
    }
    case "MOVE_TO_GROUP":
      return callTool("move_tabs_to_group", message);
    case "UNGROUP":
      return callTool("ungroup_tabs", { tabIds: message.tabIds });
    case "BIND_ORIGIN": {
      const tab = (await chrome.tabs.get(Number(message.tabId ?? -1)).catch(() => undefined));
      return callTool("bind_origin_to_workstream", {
        origin: String(message.origin ?? (tab ? originOf(tab.url) : "")),
        groupId: Number(message.groupId),
        role: message.role,
      });
    }
    case "UPSERT_RULE":
      return callTool("upsert_rule", { rule: message.rule });
    case "DELETE_RULE":
      return callTool("delete_rule", { id: message.id });
    case "TOGGLE_RULE": {
      const rules = await getRules();
      await saveRules(
        rules.map((rule) =>
          rule.id === message.id ? { ...rule, enabled: Boolean(message.enabled) } : rule,
        ),
      );
      return { ok: true };
    }
    case "APPLY_RULES":
      if (Array.isArray(message.tabIds)) {
        for (const tabId of message.tabIds) await applyRulesToTab(Number(tabId), true);
        return { ok: true };
      }
      return callTool("apply_rules", {});
    case "COMPILE_RULE":
      return callTool("compile_rule", { utterance: message.utterance });
    case "PREVIEW_RULE":
      return callTool("preview_rule", message);
    case "PROMOTE_HABITS":
      return callTool("promote_habits", {});
    case "UNDO_LEARNED":
      return callTool("undo_learned_rule", {});
    case "GET_SETTINGS":
      return getSettings();
    case "GET_RULES":
      return getRules();
    case "SET_SETTINGS": {
      const current = await getSettings();
      const next = normalizeSettings({ ...current, ...(message.settings as object) });
      await saveSettings(next);
      return next;
    }
    case "ACTIVATE_TAB":
      await chrome.tabs.update(Number(message.tabId), { active: true });
      return { ok: true };
    case "CALL_TOOL":
      return callTool(String(message.name), (message.args as Record<string, unknown>) ?? {});
    default:
      return { ok: false, error: `未知消息 ${message.type}` };
  }
}
