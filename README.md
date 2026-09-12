# Tab Agent

用对话和规则整理 Chrome 标签：改标题、用 Tab Group 分组。怎么分组由你决定，插件不内置「需求组」这类业务概念。

第一版包含 Chrome 插件和 `tab-agent` CLI（MCP）。Side Panel UI 统一用 Ant Design + Ant Design X。

当前只能从 GitHub 安装：扩展尚未上架 Chrome Web Store，CLI 也尚未发布到 npm。不要运行 `npx tab-agent`，那会装到别人的包。

## 环境

- Node.js 22+
- [pnpm](https://pnpm.io)
- Chrome（需打开开发者模式）
- 可选：Cursor

## 安装

```bash
git clone https://github.com/YX-Lin/tab-agent.git
cd tab-agent
pnpm install
pnpm build
```

### 1. 加载 Chrome 扩展

1. 打开 `chrome://extensions`
2. 打开「开发者模式」
3. 「加载已解压的扩展程序」
4. 选择仓库里的 `extension/.output/chrome-mv3`

改代码时可用 `pnpm dev`，WXT 会打印热更新目录，再按上面步骤加载或刷新已加载的扩展。

### 2. 安装 Native Host（给 Cursor 用，做一次即可）

在仓库根目录执行：

```bash
pnpm exec tab-agent install
```

打开扩展侧栏 →「设置」→ 打开「允许外部 Agent 经 MCP 连接」→ 保存。

### 3. 配置 Cursor MCP

把 `<仓库根目录>` 换成 clone 后的绝对路径（Windows 可用正斜杠）：

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

示例：`E:/code/tab-agent/packages/tab-agent/dist/bin.js`。

`pnpm exec tab-agent install` 成功后，终端会打印一份已经填好本机路径的配置，可直接粘贴。

Chrome 没开或没在设置里允许时，工具会返回明确错误，而不是空列表。

## 使用

1. 点工具栏图标打开右侧 Side Panel。
2. 在「工作区」勾选标签，点「收成一组」。
3. 点某一行，在弹窗里改角色和标题。快捷键 `Alt+Shift+R` 或页面/标签右键「重命名此标签」会从工具栏图标弹出改名框。
4. 页面、工具栏图标或标签栏右键「一键整理此标签 / 此窗口」，会立刻按规则改标题并入组。
5. 「规则」里用自然语言写规则，编译预览后再保存。手工整理几次后可点「按习惯更新」。
6. 「设置」默认已指向千问 DashScope（`qwen-turbo`）。填入控制台的标准 `sk-` Key 后，即可在「对话」里口头整理分组和标题。

插件只改标题和分组，不关标签，不读页面正文。
