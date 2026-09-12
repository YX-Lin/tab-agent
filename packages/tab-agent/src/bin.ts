import {
  NATIVE_HOST_NAME,
  PINNED_EXTENSION_ID,
  PROTOCOL_VERSION,
} from "@tab-title-agent/shared";
import { installNativeHost, statusReport, uninstallNativeHost } from "./install";
import { runMcp } from "./mcp";

const HELP = `Tab Agent CLI  —  把 Chrome 扩展暴露成 MCP Server

用法:
  tab-agent mcp
  tab-agent install [--extension-id <id>]
  tab-agent uninstall
  tab-agent status
  tab-agent help

Cursor 配置:
  {
    "mcpServers": {
      "tab-agent": {
        "command": "npx",
        "args": ["-y", "tab-agent", "mcp"]
      }
    }
  }

本地开发可用:
  pnpm --filter tab-agent mcp
`;

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
        "  1. Chrome 加载 Tab Agent 扩展（开发版目录 extension/.output/chrome-mv3）",
        "  2. 在侧栏设置里打开「允许外部 Agent 经 MCP 连接」",
        "  3. 在 Cursor 里添加 MCP：npx -y tab-agent mcp",
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
    process.stdout.write(HELP);
    process.stdout.write(
      `默认扩展 ID: ${PINNED_EXTENSION_ID}\nNative Host: ${NATIVE_HOST_NAME}\n协议版本: v${PROTOCOL_VERSION}\n`,
    );
    return;
  }

  process.stderr.write(`未知命令: ${command}\n\n${HELP}`);
  process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
