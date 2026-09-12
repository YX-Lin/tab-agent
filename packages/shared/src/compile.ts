import { ROLE_LABELS, roleFromLabel, type RoleId } from "./roles";
import type { OrganizeRule } from "./types";
import { createRuleId } from "./rules";

const HOST_RE = /(?:https?:\/\/)?(?:www\.)?([a-z0-9.-]+\.[a-z]{2,}|(?:localhost|127\.0\.0\.1))(?::\d+)?/i;

export type CompileResult =
  | { ok: true; rule: OrganizeRule }
  | { ok: false; reason: string };

function inferHost(utterance: string): string | undefined {
  const match = utterance.match(HOST_RE);
  if (match?.[1]) return match[1].replace(/^www\./, "");
  if (/figma/i.test(utterance)) return "figma.com";
  if (/localhost|本地/i.test(utterance)) return "localhost";
  if (/飞书|feishu/i.test(utterance)) return "feishu.cn";
  if (/notion/i.test(utterance)) return "notion.so";
  if (/github/i.test(utterance)) return "github.com";
  return undefined;
}

function inferRole(utterance: string): RoleId | undefined {
  const fromLabel = [...utterance.matchAll(/视觉稿|技术方案|测试记录|本地|预发|线上|其他|figma|prd|staging|localhost/gi)]
    .map((item) => roleFromLabel(item[0]))
    .find(Boolean);
  if (fromLabel) return fromLabel;
  if (/设计|视觉/.test(utterance)) return "design";
  if (/方案|文档|prd/i.test(utterance)) return "spec";
  if (/测试|用例/.test(utterance)) return "test";
  if (/预发|staging|uat/i.test(utterance)) return "staging";
  if (/线上|生产|prod/i.test(utterance)) return "prod";
  if (/本地|localhost/i.test(utterance)) return "local";
  return undefined;
}

export function compileUtterance(utterance: string): CompileResult {
  const text = utterance.trim();
  if (!text) return { ok: false, reason: "请先写一句规则，例如：figma 都算视觉稿" };

  const host = inferHost(text);
  const role = inferRole(text);
  if (!host && !role) {
    return {
      ok: false,
      reason: "还不够明确。请带上网站（如 figma.com）和角色（如视觉稿、本地、预发）。",
    };
  }
  if (!host) {
    return { ok: false, reason: "请补充要匹配的网站，例如 figma.com 或 localhost。" };
  }
  if (!role) {
    return { ok: false, reason: "请补充材料角色，例如视觉稿、技术方案、本地、预发、线上。" };
  }

  const joinActive = /当前需求|当前组|当前分组|进组|放进|收进/.test(text);

  return {
    ok: true,
    rule: {
      id: createRuleId(),
      utterance: text,
      enabled: true,
      priority: 70,
      compiled: {
        match: { hostEquals: host },
        role,
        template: "[{roleLabel}] {title}",
        group: joinActive ? "active" : "none",
      },
      source: "compiled",
    },
  };
}

export function describeRule(rule: OrganizeRule): string {
  const host = rule.compiled.match.hostEquals ?? rule.compiled.match.urlGlob ?? "匹配条件";
  const role = rule.compiled.role ? ROLE_LABELS[rule.compiled.role] : "不改角色";
  return `${host} → ${role}`;
}
