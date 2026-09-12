import { ROLE_LABELS, type RoleId } from "./roles";
import type { HabitEvent, OrganizeRule } from "./types";
import { createRuleId } from "./rules";

const PROMOTE_COUNT = 3;

export function appendHabit(
  events: HabitEvent[],
  event: HabitEvent,
  limit = 500,
): HabitEvent[] {
  return [...events, event].slice(-limit);
}

function sameHostRole(events: HabitEvent[], host: string, role: RoleId) {
  const relevant = events.filter(
    (event) =>
      event.host === host &&
      (event.action === "set_role" || event.action === "set_title") &&
      event.role,
  );
  const support = relevant.filter((event) => event.role === role).length;
  const against = relevant.filter((event) => event.role !== role).length;
  return { support, against };
}

function hostExistsInManualRules(rules: OrganizeRule[], host: string) {
  return rules.some(
    (rule) =>
      (rule.source === "compiled" || rule.source === "manual") &&
      rule.compiled.match.hostEquals === host,
  );
}

export function promoteHabits(
  events: HabitEvent[],
  rules: OrganizeRule[],
): { rules: OrganizeRule[]; undos: { summary: string; next: OrganizeRule; previous?: OrganizeRule }[] } {
  const hosts = [...new Set(events.map((event) => event.host).filter(Boolean))];
  const nextRules = [...rules];
  const undos: { summary: string; next: OrganizeRule; previous?: OrganizeRule }[] = [];

  for (const host of hosts) {
    if (hostExistsInManualRules(nextRules, host)) continue;

    const roleCounts = new Map<RoleId, { support: number; against: number }>();
    for (const event of events) {
      if (event.host !== host || !event.role) continue;
      if (event.action !== "set_role" && event.action !== "set_title") continue;
      const current = roleCounts.get(event.role) ?? { support: 0, against: 0 };
      current.support += 1;
      roleCounts.set(event.role, current);
    }

    let best: { role: RoleId; support: number; against: number } | undefined;
    for (const [role, counts] of roleCounts) {
      const { against } = sameHostRole(events, host, role);
      const candidate = { role, support: counts.support, against };
      if (!best || candidate.support > best.support) best = candidate;
    }

    const existing = nextRules.find(
      (rule) => rule.source === "learned" && rule.compiled.match.hostEquals === host,
    );

    const restoreCount = events.filter(
      (event) => event.host === host && event.action === "restore_title",
    ).length;
    const ungroupCount = events.filter(
      (event) => event.host === host && event.action === "ungroup",
    ).length;

    if (existing && (restoreCount >= 2 || ungroupCount >= 2 || (best && best.against >= best.support))) {
      if (existing.enabled) {
        const disabled = { ...existing, enabled: false };
        const index = nextRules.findIndex((rule) => rule.id === existing.id);
        nextRules[index] = disabled;
        undos.push({
          summary: `已停用习惯规则：${host}`,
          previous: existing,
          next: disabled,
        });
      }
      continue;
    }

    if (!best || best.support < PROMOTE_COUNT || best.against > 0) continue;

    const joinActive =
      events.filter(
        (event) =>
          event.host === host &&
          event.action === "move_to_group" &&
          event.activeGroup,
      ).length >= PROMOTE_COUNT;

    const next: OrganizeRule = {
      id: existing?.id ?? createRuleId(),
      utterance: `习惯：${host} 通常是${ROLE_LABELS[best.role]}`,
      enabled: true,
      priority: 50,
      compiled: {
        match: { hostEquals: host },
        role: best.role,
        template: "[{roleLabel}] {title}",
        group: joinActive ? "active" : existing?.compiled.group ?? "none",
      },
      source: "learned",
    };

    if (existing) {
      const index = nextRules.findIndex((rule) => rule.id === existing.id);
      if (
        existing.compiled.role === next.compiled.role &&
        existing.compiled.group === next.compiled.group &&
        existing.enabled
      ) {
        continue;
      }
      nextRules[index] = next;
      undos.push({
        summary: `已根据习惯更新：${host} → ${ROLE_LABELS[best.role]}`,
        previous: existing,
        next,
      });
    } else {
      nextRules.push(next);
      undos.push({
        summary: `已根据习惯更新：${host} → ${ROLE_LABELS[best.role]}`,
        next,
      });
    }
  }

  return { rules: nextRules, undos };
}
