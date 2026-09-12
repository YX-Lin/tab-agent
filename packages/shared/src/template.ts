import { ROLE_LABELS, type RoleId } from "./roles";
import { hostOf, parseUrl } from "./url";

export type TemplateContext = {
  title: string;
  url: string;
  role?: RoleId;
  group?: string;
  index?: number;
};

export function renderTemplate(template: string, ctx: TemplateContext): string {
  const url = parseUrl(ctx.url);
  const pathname = url?.pathname ?? "";
  const parts = pathname.split("/").filter(Boolean);
  const values: Record<string, string> = {
    title: ctx.title,
    hostname: hostOf(ctx.url),
    pathname,
    pathTail: parts.at(-1) ?? "",
    search: url?.search ?? "",
    index: String((ctx.index ?? 0) + 1),
    roleLabel: ctx.role ? ROLE_LABELS[ctx.role] : "",
    group: ctx.group ?? "",
  };
  return template.replace(/\{([a-zA-Z]+)\}/g, (_, key: string) => values[key] ?? "");
}

export function stripRolePrefix(title: string): string {
  return title.replace(/^\[[^\]]+\]\s*/, "").trim();
}

export function withRolePrefix(roleLabel: string, title: string): string {
  const body = stripRolePrefix(title);
  return `[${roleLabel}] ${body}`;
}
