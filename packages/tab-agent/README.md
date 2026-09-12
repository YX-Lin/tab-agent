# Tab Agent CLI

把 Tab Agent Chrome 扩展暴露成 MCP Server，供 Cursor 调用同一套标签整理工具。

当前未发布到 npm。请从 GitHub 克隆整个仓库后使用，不要运行 `npx tab-agent`（那是别人的包）。

完整步骤见仓库根目录 [README](../../README.md)。摘要：

```bash
pnpm install
pnpm build
pnpm exec tab-agent install
```

Chrome 加载 `extension/.output/chrome-mv3`，在侧栏设置打开「允许外部 Agent 经 MCP 连接」。

Cursor MCP（把 `<仓库根目录>` 换成绝对路径）：

```json
{
  "mcpServers": {
    "tab-agent": {
      "command": "node",
      "args": ["<仓库根目录>/packages/tab-agent/dist/bin.js", "mcp"]
    }
  }
}
```

`pnpm exec tab-agent install` 成功后会打印填好本机路径的配置。
