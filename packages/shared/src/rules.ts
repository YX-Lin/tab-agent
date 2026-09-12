import type { OrganizeRule } from "./types";
import { hostOf, urlMatchesGlob } from "./url";

export function ruleMatches(
  rule: OrganizeRule,
  input: { url: string; title: string },
): boolean {
  if (!rule.enabled) return false;
  const { match } = rule.compiled;
  if (!match.hostEquals && !match.urlGlob && !match.titleRegex) return false;

  if (match.hostEquals) {
    const host = hostOf(input.url);
    if (host !== match.hostEquals.replace(/^www\./, "")) return false;
  }
  if (match.urlGlob && !urlMatchesGlob(match.urlGlob, input.url)) return false;
  if (match.titleRegex) {
    try {
      if (!new RegExp(match.titleRegex, "i").test(input.title)) return false;
    } catch {
      return false;
    }
  }
  return true;
}

export function pickRule(
  rules: OrganizeRule[],
  input: { url: string; title: string },
): OrganizeRule | undefined {
  return [...rules]
    .filter((rule) => ruleMatches(rule, input))
    .sort((a, b) => b.priority - a.priority)[0];
}

export function createRuleId(): string {
  return crypto.randomUUID();
}

export const DEFAULT_RULES: OrganizeRule[] = [
  {
    id: "builtin-figma",
    utterance: "内置：Figma 是视觉稿",
    enabled: true,
    priority: 80,
    compiled: {
      match: { hostEquals: "figma.com" },
      role: "design",
      template: "[{roleLabel}] {title}",
      group: "none",
    },
    source: "compiled",
  },
  {
    id: "builtin-localhost",
    utterance: "内置：localhost 是本地",
    enabled: true,
    priority: 80,
    compiled: {
      match: { hostEquals: "localhost" },
      role: "local",
      template: "[{roleLabel}] {title}",
      group: "none",
    },
    source: "compiled",
  },
  {
    id: "builtin-lan-local",
    utterance: "内置：127.0.0.1 是本地",
    enabled: true,
    priority: 80,
    compiled: {
      match: { hostEquals: "127.0.0.1" },
      role: "local",
      template: "[{roleLabel}] {title}",
      group: "none",
    },
    source: "compiled",
  },
  {
    id: "builtin-feishu",
    utterance: "内置：飞书文档是技术方案",
    enabled: true,
    priority: 60,
    compiled: {
      match: { urlGlob: "https://*.feishu.cn/*" },
      role: "spec",
      template: "[{roleLabel}] {title}",
      group: "none",
    },
    source: "compiled",
  },
  {
    id: "builtin-notion",
    utterance: "内置：Notion 是技术方案",
    enabled: true,
    priority: 60,
    compiled: {
      match: { hostEquals: "notion.so" },
      role: "spec",
      template: "[{roleLabel}] {title}",
      group: "none",
    },
    source: "compiled",
  },
];
