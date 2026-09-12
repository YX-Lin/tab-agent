import { Alert, Form, Input, Switch, Button, Flex, Typography, message } from "antd";
import { useEffect, useState } from "react";
import type { ExtensionSettings, McpStatus } from "@tab-title-agent/shared";
import { send } from "../../lib/messages";

type Props = {
  settings: ExtensionSettings;
  onRefresh: () => void;
};

type CommandInfo = {
  name: string;
  description?: string;
  shortcut?: string;
};

const COMMAND_LABELS: Record<string, string> = {
  "rename-current-tab": "重命名当前标签",
  _execute_action: "打开侧栏",
};

function formatShortcut(shortcut?: string) {
  if (!shortcut) return "未设置";
  return shortcut.replaceAll("+", " + ");
}

async function refreshCommands(setCommands: (value: CommandInfo[]) => void) {
  const list = await chrome.commands.getAll();
  setCommands(list.filter((item) => item.name !== "_execute_browser_action"));
}

async function openShortcutSettings() {
  const api = chrome.commands as typeof chrome.commands & {
    openShortcutSettings?: () => Promise<void>;
  };
  if (typeof api.openShortcutSettings === "function") {
    await api.openShortcutSettings();
    return;
  }
  await chrome.tabs.create({ url: "chrome://extensions/shortcuts" });
}

function mcpCursorConfig() {
  return `{
  "mcpServers": {
    "tab-agent": {
      "command": "npx",
      "args": ["-y", "tab-agent", "mcp"]
    }
  }
}`;
}

export function SettingsPane({ settings, onRefresh }: Props) {
  const [form] = Form.useForm<ExtensionSettings>();
  const [commands, setCommands] = useState<CommandInfo[]>([]);
  const [mcpStatus, setMcpStatus] = useState<McpStatus | null>(null);

  useEffect(() => {
    void refreshCommands(setCommands);
    const onFocus = () => void refreshCommands(setCommands);
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!form.isFieldsTouched()) {
      form.setFieldsValue(settings);
    }
  }, [form, settings]);

  useEffect(() => {
    let cancelled = false;
    const tick = async () => {
      try {
        const status = await send<McpStatus>({ type: "GET_MCP_STATUS" });
        if (!cancelled) setMcpStatus(status);
      } catch {
        if (!cancelled) setMcpStatus(null);
      }
    };
    void tick();
    const timer = window.setInterval(() => void tick(), 2000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [settings.mcpEnabled]);

  const extensionId = mcpStatus?.extensionId || chrome.runtime.id;
  const connected = Boolean(mcpStatus?.mcpEnabled && mcpStatus.nativeConnected && mcpStatus.relaySeen);

  return (
    <Form
      form={form}
      layout="vertical"
      initialValues={settings}
      onFinish={async (values) => {
        const saved = await send<ExtensionSettings>({ type: "SET_SETTINGS", settings: values });
        form.setFieldsValue(saved);
        message.success("已保存到本机");
        onRefresh();
      }}
    >
      <Form.Item
        label="接口地址"
        name="apiBaseUrl"
        extra="默认走千问 DashScope 兼容模式。Token Plan 团队版请改成 token-plan 的 compatible-mode 地址。"
      >
        <Input placeholder="https://dashscope.aliyuncs.com/compatible-mode/v1" />
      </Form.Item>
      <Form.Item
        label="API Key"
        name="apiKey"
        extra="在千问控制台创建标准 sk- 密钥，只存在本机扩展存储。"
      >
        <Input.Password placeholder="sk-..." />
      </Form.Item>
      <Form.Item
        label="模型"
        name="model"
        extra="标签整理用量不大，默认用最便宜的 qwen-turbo。Token Plan 密钥请改成 qwen3.6-flash。"
      >
        <Input placeholder="qwen-turbo" />
      </Form.Item>
      <Form.Item
        label="快捷键"
        extra="重命名会从工具栏图标弹出小窗，点扩展图标仍打开侧栏。点修改会打开 Chrome 快捷键页。"
      >
        <Flex vertical gap={8}>
          {commands.map((item) => (
            <Flex key={item.name} justify="space-between" align="center" gap={8}>
              <Typography.Text>
                {COMMAND_LABELS[item.name] ?? item.description ?? item.name}
              </Typography.Text>
              <Typography.Text type="secondary">{formatShortcut(item.shortcut)}</Typography.Text>
            </Flex>
          ))}
          <Button onClick={() => void openShortcutSettings()}>修改快捷键</Button>
        </Flex>
      </Form.Item>
      <Form.Item label="根据习惯自动更新规则" name="habitLearning" valuePropName="checked">
        <Switch />
      </Form.Item>
      <Form.Item
        label="允许外部 Agent 经 MCP 连接"
        name="mcpEnabled"
        valuePropName="checked"
        extra="打开后，Cursor 等可以通过 tab-agent CLI 调用同一套整理工具。"
      >
        <Switch />
      </Form.Item>
      <Flex vertical gap={8} style={{ marginBottom: 16 }}>
        <Alert
          type={connected ? "success" : settings.mcpEnabled ? "warning" : "info"}
          showIcon
          message={
            connected
              ? "MCP 已连接"
              : settings.mcpEnabled
                ? "等待 CLI 连接"
                : "MCP 未开启"
          }
          description={
            mcpStatus?.lastError && settings.mcpEnabled
              ? mcpStatus.lastError
              : settings.mcpEnabled
                ? "先运行 tab-agent install，再在 Cursor 里启动 tab-agent mcp。"
                : "打开开关并保存后，扩展会连接本机 Native Host。"
          }
        />
        <Typography.Text type="secondary">扩展 ID</Typography.Text>
        <Typography.Text copyable>{extensionId}</Typography.Text>
        <Typography.Text type="secondary">本机安装（一次）</Typography.Text>
        <Typography.Paragraph copyable code>
          {`pnpm exec tab-agent install --extension-id ${extensionId}`}
        </Typography.Paragraph>
        <Typography.Text type="secondary">Cursor MCP 配置</Typography.Text>
        <Typography.Paragraph copyable>
          <pre style={{ margin: 0, whiteSpace: "pre-wrap" }}>{mcpCursorConfig()}</pre>
        </Typography.Paragraph>
      </Flex>
      <Button type="primary" htmlType="submit">
        保存设置
      </Button>
    </Form>
  );
}
