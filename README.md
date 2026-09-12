# Tab Agent

用对话和规则整理 Chrome 标签：改标题、用 Tab Group 分组。怎么分组由你决定，插件不内置「需求组」这类业务概念。

第一版包含 Chrome 插件和 `tab-agent` CLI（MCP）。Side Panel UI 统一用 Ant Design + Ant Design X。

## 本地加载

```bash
pnpm install
pnpm dev
```

Chrome 打开 `chrome://extensions` → 打开开发者模式 → 加载已解压的扩展程序 → 选择 `extension/.output/chrome-mv3`（`pnpm dev` 时 WXT 会打印确切目录）。

`pnpm build` 会产出可打包的构建。

## 使用

1. 点工具栏图标打开右侧 Side Panel。
2. 在「工作区」勾选标签，点「收成一组」。
3. 点某一行，在弹窗里改角色和标题。快捷键 `Alt+Shift+R` 或页面/标签右键「重命名此标签」会从工具栏图标弹出改名框。
4. 页面、工具栏图标或标签栏右键「一键整理此标签 / 此窗口」，会立刻按规则改标题并入组。
5. 「规则」里用自然语言写规则，编译预览后再保存。手工整理几次后可点「按习惯更新」。
6. 「设置」默认已指向千问 DashScope（`qwen-turbo`）。填入控制台的标准 `sk-` Key 后，即可在「对话」里口头整理分组和标题。

## MCP（给 Cursor 用）

扩展自己当执行器，CLI 当 MCP Server。Cursor 启动 `tab-agent mcp` 后，会在本机写下中继端口；Chrome Native Host 发现后把工具调用转进扩展。

```bash
pnpm --filter tab-agent build
pnpm exec tab-agent install
```

在侧栏设置打开「允许外部 Agent 经 MCP 连接」，然后把下面这段加进 Cursor 的 MCP 配置：

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

本地开发也可以用 `pnpm exec tab-agent mcp`。Chrome 没开或没点允许时，工具会返回明确错误，而不是空列表。

插件只改标题和分组，不关标签，不读页面正文。
