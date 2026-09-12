import type { RoleId } from "./roles";

export const PROTOCOL_VERSION = 1;

export type TitleSource = "rule" | "chat" | "mcp" | "manual";
export type TitleSticky = "until-navigate" | "until-closed" | "url-pattern";
export type RuleSource = "compiled" | "manual" | "learned";
export type GroupStrategy = "active" | "bound-origin" | "none";

export type TabTitleOverride = {
  tabId: number;
  urlKey: string;
  originalTitle: string;
  customTitle: string;
  role?: RoleId;
  source: TitleSource;
  sticky: TitleSticky;
  locked: boolean;
};

export type OrganizeRule = {
  id: string;
  utterance: string;
  enabled: boolean;
  priority: number;
  compiled: {
    match: {
      hostEquals?: string;
      urlGlob?: string;
      titleRegex?: string;
    };
    role?: RoleId;
    template?: string;
    group: GroupStrategy;
  };
  source: RuleSource;
};

export type HabitEvent = {
  at: number;
  host: string;
  action:
    | "set_title"
    | "set_role"
    | "move_to_group"
    | "ungroup"
    | "restore_title";
  role?: RoleId;
  groupName?: string;
  activeGroup?: boolean;
};

export type OriginBinding = {
  origin: string;
  groupTitle: string;
  role?: RoleId;
};

export type ExtensionSettings = {
  apiBaseUrl: string;
  apiKey: string;
  model: string;
  habitLearning: boolean;
  mcpEnabled: boolean;
};

export type TabSnapshot = {
  id: number;
  windowId: number;
  index: number;
  url: string;
  title: string;
  originalTitle: string;
  customTitle?: string;
  role?: RoleId;
  locked: boolean;
  pinned: boolean;
  active: boolean;
  favIconUrl?: string;
  groupId: number;
  unsupported: boolean;
};

export type GroupSnapshot = {
  id: number;
  windowId: number;
  title: string;
  color: string;
  collapsed: boolean;
  isActive: boolean;
  tabIds: number[];
};

export type WindowSnapshot = {
  windowId: number;
  focused: boolean;
  activeGroupId: number | null;
  groups: GroupSnapshot[];
  ungrouped: TabSnapshot[];
  tabs: TabSnapshot[];
};

export type LearnedUndo = {
  at: number;
  summary: string;
  previous?: OrganizeRule;
  next: OrganizeRule;
};

export const DEFAULT_SETTINGS: ExtensionSettings = {
  apiBaseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  apiKey: "",
  model: "qwen-turbo",
  habitLearning: true,
  mcpEnabled: false,
};

export const LEGACY_OPENAI_DEFAULTS = {
  apiBaseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
} as const;

export const LEGACY_QWEN_DEFAULTS = {
  model: "qwen3.6-plus",
} as const;
