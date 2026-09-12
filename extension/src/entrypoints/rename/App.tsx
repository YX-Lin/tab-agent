import { App as AntdApp, Button } from "antd";
import { XProvider } from "@ant-design/x";
import zhCN from "antd/locale/zh_CN";
import { useEffect, useState } from "react";
import type { TabSnapshot, WindowSnapshot } from "@tab-title-agent/shared";
import { RenameForm } from "../../components/RenameForm";
import { send } from "../../lib/messages";
import { appTheme } from "../sidepanel/theme";

function tabIdFromUrl() {
  const raw = new URLSearchParams(location.search).get("tabId");
  const tabId = raw ? Number(raw) : NaN;
  return Number.isInteger(tabId) ? tabId : null;
}

function dismiss() {
  window.close();
}

function RenamePopover() {
  const [tab, setTab] = useState<TabSnapshot | null>(null);
  const [groups, setGroups] = useState<{ id: number; title: string }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const tabId = tabIdFromUrl();
      if (tabId == null) {
        setError("没有要修改的标签");
        return;
      }
      try {
        const chromeTab = await chrome.tabs.get(tabId);
        const snapshot = await send<WindowSnapshot>({
          type: "GET_SNAPSHOT",
          windowId: chromeTab.windowId,
        });
        const next = snapshot.tabs.find((item) => item.id === tabId) ?? null;
        if (!next) {
          setError("找不到这个标签，可能已经关掉了");
          return;
        }
        setTab(next);
        setGroups(snapshot.groups.map((group) => ({ id: group.id, title: group.title })));
      } catch {
        setError("读不到这个标签");
      }
    };
    void load();
  }, []);

  if (error) {
    return (
      <div className="rename-shell">
        <h1>修改标签</h1>
        <p className="rename-status">{error}</p>
        <Button onClick={dismiss}>关闭</Button>
      </div>
    );
  }

  if (!tab) {
    return (
      <div className="rename-shell">
        <h1>修改标签</h1>
        <p className="rename-status">正在读取标签…</p>
      </div>
    );
  }

  return (
    <div className="rename-shell">
      <h1>修改标签</h1>
      <RenameForm tab={tab} groups={groups} onCancel={dismiss} onDone={dismiss} />
    </div>
  );
}

export function App() {
  return (
    <XProvider locale={zhCN} theme={appTheme}>
      <AntdApp>
        <RenamePopover />
      </AntdApp>
    </XProvider>
  );
}
