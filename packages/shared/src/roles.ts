export const ROLE_IDS = [
  "spec",
  "design",
  "test",
  "local",
  "staging",
  "prod",
  "other",
] as const;

export type RoleId = (typeof ROLE_IDS)[number];

export const ROLE_LABELS: Record<RoleId, string> = {
  spec: "技术方案",
  design: "视觉稿",
  test: "测试记录",
  local: "本地",
  staging: "预发",
  prod: "线上",
  other: "其他",
};

export const ROLE_COLORS: Record<RoleId, string> = {
  spec: "#2f6fed",
  design: "#c2410c",
  test: "#7c3aed",
  local: "#0f766e",
  staging: "#a16207",
  prod: "#b91c1c",
  other: "#57534e",
};

export function isRoleId(value: string): value is RoleId {
  return (ROLE_IDS as readonly string[]).includes(value);
}

export function roleFromLabel(text: string): RoleId | undefined {
  const normalized = text.trim().toLowerCase();
  for (const id of ROLE_IDS) {
    if (id === normalized || ROLE_LABELS[id] === text.trim()) return id;
  }
  const aliases: Record<string, RoleId> = {
    方案: "spec",
    文档: "spec",
    prd: "spec",
    设计: "design",
    设计稿: "design",
    视觉: "design",
    figma: "design",
    测试: "test",
    用例: "test",
    本地: "local",
    localhost: "local",
    预发: "staging",
    测试环境: "staging",
    staging: "staging",
    uat: "staging",
    线上: "prod",
    生产: "prod",
    prod: "prod",
  };
  return aliases[normalized];
}
