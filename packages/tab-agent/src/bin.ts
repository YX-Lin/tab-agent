import { fileURLToPath } from "node:url";
import {
  NATIVE_HOST_NAME,
  PINNED_EXTENSION_ID,
  PROTOCOL_VERSION,
} from "@tab-title-agent/shared";
import { installNativeHost, statusReport, uninstallNativeHost } from "./install";
import { runMcp } from "./mcp";

function thisBinPath() {
  return fileURLToPath(import.meta.url);
}

function cursorMcpSnippet() {
  return JSON.stringify(
    {
      mcpServers: {
        "tab-agent": {
          command: "node",
          args: [thisBinPath(), "mcp"],
        },
      },
    },
    null,
    2,
  );
}

function helpText() {
  return `Tab Agent CLI  —  把 Chrome 扩展暴露成 MCP Server

当前未发布到 npm，请从 GitHub 克隆仓库后使用。不要运行 npx tab-agent。

用法:
  tab-agent mcp
  tab-agent install [--extension-id <id>]
  tab-agent uninstall
  tab-agent status
  tab-agent help

Cursor 配置（本机路径）:
${cursorMcpSnippet()}

本地开发可用:
  pnpm --filter tab-agent mcp
`;
}

function argValue(args: string[], name: string) {
  const index = args.indexOf(name);
  if (index < 0) return undefined;
  return args[index + 1];
}

async function main() {
  const [command = "help", ...rest] = process.argv.slice(2);

  if (command === "mcp") {
    await runMcp();
    return;
  }

  if (command === "install") {
    const state = installNativeHost({
      extensionId: argValue(rest, "--extension-id"),
    });
    process.stdout.write(
      [
        "已安装 Native Host。",
        `  扩展 ID     ${state.extensionId}`,
        `  Host 名称   ${state.hostName}`,
        `  协议版本    v${state.protocolVersion}`,
        `  清单        ${state.manifest}`,
        "",
        "接下来：",
        "  1. Chrome 打开开发者模式，加载已解压扩展 extension/.output/chrome-mv3",
        "  2. 在侧栏设置里打开「允许外部 Agent 经 MCP 连接」并保存",
        "  3. 把下面这段加进 Cursor 的 MCP 配置（当前未发 npm，不要用 npx tab-agent）：",
        "",
        cursorMcpSnippet(),
        "",
      ].join("\n"),
    );
    return;
  }

  if (command === "uninstall") {
    uninstallNativeHost();
    process.stdout.write("已卸载 Native Host 注册。\n");
    return;
  }

  if (command === "status") {
    const status = statusReport();
    process.stdout.write(`${JSON.stringify(status, null, 2)}\n`);
    return;
  }

  if (command === "help" || command === "-h" || command === "--help") {
    process.stdout.write(helpText());
    process.stdout.write(
      `默认扩展 ID: ${PINNED_EXTENSION_ID}\nNative Host: ${NATIVE_HOST_NAME}\n协议版本: v${PROTOCOL_VERSION}\n`,
    );
    return;
  }

  process.stderr.write(`未知命令: ${command}\n\n${helpText()}`);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
