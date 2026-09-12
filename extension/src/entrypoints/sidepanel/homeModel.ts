import {
  hostOf,
  type ExtensionSettings,
  type WindowSnapshot,
} from "@tab-title-agent/shared";

export type HomePrompt = {
  key: string;
  label: string;
  description: string;
  prompt: string;
};

export type HomeModel = {
  title: string;
  description: string;
  stats: { key: string; label: string }[];
  prompts: HomePrompt[];
  placeholder: string;
  needsKey: boolean;
};

function shortTitle(value: string, max = 16) {
  const text = value.trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max)}…`;
}

function isLocalHost(host: string) {
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "[::1]" ||
    host.endsWith(".localhost")
  );
}

function isDesignHost(host: string) {
  return /(^|\.)(figma\.com|lanhuapp\.com|mastergo\.com|pixso\.cn)$/i.test(host);
}

function isDocHost(host: string) {
  return /(^|\.)(notion\.so|notion\.site|yuque\.com|feishu\.cn|larkoffice\.com|docs\.google\.com)$/i.test(
    host,
  );
}

function isStagingHost(host: string) {
  return /(^|\.)(staging|stg|uat|pre|preview)(\.|-)/i.test(host) || host.includes("test.");
}

function hostCounts(snapshot: WindowSnapshot | null) {
  const counts = new Map<string, number>();
  for (const tab of snapshot?.tabs ?? []) {
    const host = hostOf(tab.url);
    if (!host || tab.unsupported) continue;
    counts.set(host, (counts.get(host) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

export function buildHomeModel(
  snapshot: WindowSnapshot | null,
  settings: ExtensionSettings,
  hasRules: boolean,
): HomeModel {
  const tabs = snapshot?.tabs ?? [];
  const groups = snapshot?.groups ?? [];
  const ungrouped = snapshot?.ungrouped ?? [];
  const active = tabs.find((tab) => tab.active && !tab.unsupported);
  const hosts = hostCounts(snapshot);
  const localCount = tabs.filter((tab) => isLocalHost(hostOf(tab.url))).length;
  const designCount = tabs.filter((tab) => isDesignHost(hostOf(tab.url))).length;
  const docCount = tabs.filter((tab) => isDocHost(hostOf(tab.url))).length;
  const stagingCount = tabs.filter((tab) => isStagingHost(hostOf(tab.url))).length;
  const topHost = hosts.find(([, count]) => count >= 2);

  const stats: HomeModel["stats"] = [];
  if (tabs.length) stats.push({ key: "tabs", label: `${tabs.length} 个标签` });
  if (groups.length) stats.push({ key: "groups", label: `${groups.length} 个组` });
  if (ungrouped.length) stats.push({ key: "loose", label: `${ungrouped.length} 个未分组` });

  const prompts: HomePrompt[] = [];
  const add = (item: HomePrompt) => {
    if (prompts.some((prompt) => prompt.key === item.key)) return;
    if (prompts.length >= 4) return;
    prompts.push(item);
  };

  if (ungrouped.length >= 2) {
    add({
      key: "group-loose",
      label: `收起 ${ungrouped.length} 个未分组`,
      description: "按网站收成标签组",
      prompt: "把当前窗口未分组的标签按网站收成标签组，组名用网站名。",
    });
  }

  if (topHost) {
    add({
      key: "group-host",
      label: `把 ${shortTitle(topHost[0], 14)} 收成一组`,
      description: `${topHost[1]} 个同一站点`,
      prompt: `把 ${topHost[0]} 的标签收成一个标签组，组名用 ${topHost[0]}。`,
    });
  }

  if (localCount) {
    add({
      key: "mark-local",
      label: "本地页标成「本地」",
      description: `${localCount} 个 localhost`,
      prompt: "把 localhost 和 127.0.0.1 的标签标题标成「本地」角色。",
    });
  }

  if (designCount) {
    add({
      key: "mark-design",
      label: "设计稿标成「视觉稿」",
      description: `${designCount} 个设计站`,
      prompt: "把 Figma、蓝湖、MasterGo 这类设计站的标签标成「视觉稿」角色。",
    });
  }

  if (docCount) {
    add({
      key: "mark-spec",
      label: "文档标成「技术方案」",
      description: `${docCount} 个文档页`,
      prompt: "把 Notion、语雀、飞书文档、Google 文档这类页面标成「技术方案」角色。",
    });
  }

  if (stagingCount) {
    add({
      key: "mark-staging",
      label: "预发页标成「预发」",
      description: `${stagingCount} 个预发/测试域`,
      prompt: "把预发、staging、uat、preview 这类页面标成「预发」角色。",
    });
  }

  if (active) {
    add({
      key: "rename-active",
      label: "给当前页起短标题",
      description: shortTitle(active.title || active.url, 18),
      prompt: "给当前这个标签起一个更短、更好认的标题，保留原意。",
    });
  }

  if (groups.length) {
    add({
      key: "list-groups",
      label: "看看现在怎么分的",
      description: `${groups.length} 个组里都有什么`,
      prompt: "看看当前窗口有哪些标签组，每个组里大概是什么。",
    });
  }

  if (hasRules) {
    add({
      key: "apply-rules",
      label: "按规则整理这一窗",
      description: "套用已保存的标题和分组规则",
      prompt: "按现有规则整理当前窗口的标签。",
    });
  }

  add({
    key: "group-by-site",
    label: "按网站分成几组",
    description: "同一站点放一起",
    prompt: "把当前窗口的标签按网站分成几组。",
  });

  if (!prompts.some((item) => item.key === "rename-active")) {
    add({
      key: "rename-generic",
      label: "给当前页起短标题",
      description: "更好认，也不丢原意",
      prompt: "给当前这个标签起一个更短、更好认的标题，保留原意。",
    });
  }

  const needsKey = !settings.apiKey;
  const description = needsKey
    ? "填上千问 API Key 之后，就可以用话说分组和改标题。"
    : ungrouped.length >= 2
      ? `当前 ${tabs.length} 个标签，${ungrouped.length} 个还散着。按项目、网站或环境都可以。`
      : groups.length
        ? `已经有 ${groups.length} 个组。可以改标题、并组，或把这次收成规则。`
        : "分组、改标题、定规则都可以直接说。";

  const placeholder = needsKey
    ? "先去设置填 API Key"
    : ungrouped.length >= 2
      ? `例如：把这 ${ungrouped.length} 个散标签按网站分组`
      : "分组、改标题、定规则，直接说";

  return {
    title: "这一窗怎么收？",
    description,
    stats,
    prompts,
    placeholder,
    needsKey,
  };
}
