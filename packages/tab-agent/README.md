# Tab Agent CLI

把 Tab Agent Chrome 扩展暴露成 MCP Server，供 Cursor / Claude Desktop 调用同一套标签整理工具。

```json
{
  "mcpServers": {
    "tab-agent": {
      "command": "npx",
      "args": ["-y", "tab-agent", "mcp"]
    }
  }
}
```

本机开发：

```bash
pnpm --filter tab-agent build
pnpm exec tab-agent install
pnpm exec tab-agent mcp
```
