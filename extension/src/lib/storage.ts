import {
  DEFAULT_RULES,
  DEFAULT_SETTINGS,
  LEGACY_OPENAI_DEFAULTS,
  LEGACY_QWEN_DEFAULTS,
  type ExtensionSettings,
  type HabitEvent,
  type LearnedUndo,
  type OrganizeRule,
  type OriginBinding,
  type TabTitleOverride,
} from "@tab-title-agent/shared";

const KEYS = {
  overrides: "tta.overrides",
  rules: "tta.rules",
  habits: "tta.habits",
  settings: "tta.settings",
  activeGroup: "tta.activeGroup",
  bindings: "tta.bindings",
  undos: "tta.undos",
  rename: "tta.renameRequest",
  seeded: "tta.seeded",
} as const;

async function get<T>(key: string, fallback: T): Promise<T> {
  const result = await chrome.storage.local.get(key);
  return (result[key] as T | undefined) ?? fallback;
}

async function set(key: string, value: unknown) {
  await chrome.storage.local.set({ [key]: value });
}

export async function getOverrides(): Promise<Record<string, TabTitleOverride>> {
  return get(KEYS.overrides, {});
}

export async function saveOverrides(value: Record<string, TabTitleOverride>) {
  await set(KEYS.overrides, value);
}

export async function getRules(): Promise<OrganizeRule[]> {
  return get(KEYS.rules, DEFAULT_RULES);
}

export async function saveRules(rules: OrganizeRule[]) {
  await set(KEYS.rules, rules);
}

export async function seedDefaults() {
  const seeded = await get(KEYS.seeded, false);
  if (!seeded) {
    const existing = await chrome.storage.local.get(KEYS.rules);
    if (!existing[KEYS.rules]) await saveRules(DEFAULT_RULES);
    await set(KEYS.seeded, true);
  }
  await loosenBuiltinGroupRules();
}

async function loosenBuiltinGroupRules() {
  const rules = await getRules();
  let changed = false;
  const next = rules.map((rule) => {
    if (!rule.id.startsWith("builtin-") || rule.compiled.group !== "active") return rule;
    changed = true;
    return { ...rule, compiled: { ...rule.compiled, group: "none" as const } };
  });
  if (changed) await saveRules(next);
}

export async function getHabits(): Promise<HabitEvent[]> {
  return get(KEYS.habits, []);
}

export async function saveHabits(events: HabitEvent[]) {
  await set(KEYS.habits, events);
}

export function normalizeSettings(value: Partial<ExtensionSettings>): ExtensionSettings {
  const next: ExtensionSettings = {
    apiBaseUrl:
      String(value.apiBaseUrl ?? DEFAULT_SETTINGS.apiBaseUrl).trim() || DEFAULT_SETTINGS.apiBaseUrl,
    apiKey: String(value.apiKey ?? "").trim(),
    model: String(value.model ?? DEFAULT_SETTINGS.model).trim() || DEFAULT_SETTINGS.model,
    habitLearning: value.habitLearning ?? DEFAULT_SETTINGS.habitLearning,
    mcpEnabled: value.mcpEnabled ?? DEFAULT_SETTINGS.mcpEnabled,
  };
  if (!value.apiBaseUrl || value.apiBaseUrl === LEGACY_OPENAI_DEFAULTS.apiBaseUrl) {
    next.apiBaseUrl = DEFAULT_SETTINGS.apiBaseUrl;
  }
  if (
    !value.model ||
    value.model === LEGACY_OPENAI_DEFAULTS.model ||
    value.model === LEGACY_QWEN_DEFAULTS.model
  ) {
    next.model = DEFAULT_SETTINGS.model;
  }
  return next;
}

export async function getSettings(): Promise<ExtensionSettings> {
  const stored = await get<Partial<ExtensionSettings>>(KEYS.settings, {});
  return normalizeSettings({ ...DEFAULT_SETTINGS, ...stored });
}

export async function saveSettings(settings: ExtensionSettings) {
  await set(KEYS.settings, normalizeSettings(settings));
}

export async function getActiveGroups(): Promise<Record<string, number>> {
  return get(KEYS.activeGroup, {});
}

export async function saveActiveGroups(value: Record<string, number>) {
  await set(KEYS.activeGroup, value);
}

export async function getBindings(): Promise<OriginBinding[]> {
  return get(KEYS.bindings, []);
}

export async function saveBindings(value: OriginBinding[]) {
  await set(KEYS.bindings, value);
}

export async function getUndos(): Promise<LearnedUndo[]> {
  return get(KEYS.undos, []);
}

export async function saveUndos(value: LearnedUndo[]) {
  await set(KEYS.undos, value);
}

export type RenameRequest = {
  tabId: number;
  nonce: number;
};

export async function setRenameRequest(tabId: number) {
  await chrome.storage.session.set({
    [KEYS.rename]: { tabId, nonce: Date.now() } satisfies RenameRequest,
  });
}

export async function getRenameRequest(): Promise<RenameRequest | undefined> {
  const result = await chrome.storage.session.get(KEYS.rename);
  return result[KEYS.rename] as RenameRequest | undefined;
}

export const STORAGE_KEYS = KEYS;
