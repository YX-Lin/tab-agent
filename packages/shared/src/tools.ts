export const TOOL_DEFINITIONS = [
  {
    type: "function" as const,
    function: {
      name: "list_tabs",
      description: "列出当前窗口的标签，含角色、所在标签组和是否手动锁定。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_groups",
      description: "列出当前窗口的 Chrome 标签组。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_tab_title",
      description: "设置某个标签的标题和材料角色。",
      parameters: {
        type: "object",
        properties: {
          tabId: { type: "number" },
          title: { type: "string" },
          role: {
            type: "string",
            enum: ["spec", "design", "test", "local", "staging", "prod", "other"],
          },
        },
        required: ["tabId", "title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "restore_tab_title",
      description: "恢复标签的原始标题并解锁。",
      parameters: {
        type: "object",
        properties: { tabId: { type: "number" } },
        required: ["tabId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "create_group",
      description: "把指定标签收成一个标签组。",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string" },
          tabIds: { type: "array", items: { type: "number" } },
        },
        required: ["title", "tabIds"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "rename_group",
      description: "重命名标签组。",
      parameters: {
        type: "object",
        properties: {
          groupId: { type: "number" },
          title: { type: "string" },
        },
        required: ["groupId", "title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_active_workstream",
      description: "把某个标签组设为当前组，之后「进当前组」会进这里。",
      parameters: {
        type: "object",
        properties: { groupId: { type: "number" } },
        required: ["groupId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "move_tabs_to_group",
      description: "把标签移入某个标签组。",
      parameters: {
        type: "object",
        properties: {
          tabIds: { type: "array", items: { type: "number" } },
          groupId: { type: "number" },
        },
        required: ["tabIds", "groupId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "ungroup_tabs",
      description: "把标签移出标签组。",
      parameters: {
        type: "object",
        properties: {
          tabIds: { type: "array", items: { type: "number" } },
        },
        required: ["tabIds"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "bind_origin_to_workstream",
      description: "把某个站点绑到指定标签组，之后该站点优先进这个组。",
      parameters: {
        type: "object",
        properties: {
          origin: { type: "string" },
          groupId: { type: "number" },
          role: {
            type: "string",
            enum: ["spec", "design", "test", "local", "staging", "prod", "other"],
          },
        },
        required: ["origin", "groupId"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "compile_rule",
      description: "把自然语言编译成结构化规则，先不保存。",
      parameters: {
        type: "object",
        properties: { utterance: { type: "string" } },
        required: ["utterance"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "preview_rule",
      description: "预览一条规则会命中当前窗口的哪些标签。",
      parameters: {
        type: "object",
        properties: { ruleId: { type: "string" }, utterance: { type: "string" } },
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "upsert_rule",
      description: "保存或更新一条规则。",
      parameters: {
        type: "object",
        properties: { rule: { type: "object" } },
        required: ["rule"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_rule",
      description: "删除一条规则。",
      parameters: {
        type: "object",
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "apply_rules",
      description: "对当前窗口立即套用规则。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "promote_habits",
      description: "根据最近的手工整理立刻更新习惯规则。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "undo_learned_rule",
      description: "撤销最近一次习惯规则变更。",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "list_habit_insights",
      description: "查看最近习惯事件和已学习规则。",
      parameters: { type: "object", properties: {} },
    },
  },
] as const;

export const AGENT_SYSTEM_PROMPT = `你是 Chrome 标签整理助手。用 Chrome Tab Group 做分组、用标题做标记。怎么分组听用户的：按项目、需求、网站、环境都可以，不要假定一定按「需求」分组。

标题可以用角色前缀（技术方案、视觉稿、测试记录、本地、预发、线上），只在用户提到这些角色、或已有规则/标题已经在用时才套用。

你只能整理标题和分组，禁止关闭标签、导航、执行页面脚本，禁止编造 tabId 或 groupId。操作前先 list_tabs / list_groups。改标题要用 set_tab_title；用户说「以后都这样」才 compile_rule 并 upsert_rule。手动锁定的标题不要强行覆盖，除非用户明确要求。`;
