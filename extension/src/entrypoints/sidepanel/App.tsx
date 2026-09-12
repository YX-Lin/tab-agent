import { App as AntdApp, Button, Input, Modal, Tooltip } from "antd";
import {
  ApartmentOutlined,
  LeftOutlined,
  SettingOutlined,
  SlidersOutlined,
} from "@ant-design/icons";
import { XProvider } from "@ant-design/x";
import zhCN from "antd/locale/zh_CN";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useMemo, useState, type ReactNode } from "react";
import type { GroupSnapshot, TabSnapshot } from "@tab-title-agent/shared";
import { send } from "../../lib/messages";
import { ChatPane } from "./ChatPane";
import { RenameModal } from "./RenameModal";
import { RulesPane } from "./RulesPane";
import { SettingsPane } from "./SettingsPane";
import { Workbench } from "./Workbench";
import { useSnapshot } from "./useSnapshot";
import { appTheme } from "./theme";

type Panel = "workspace" | "rules" | "settings";

const PANEL_TITLE: Record<Panel, string> = {
  workspace: "工作区",
  rules: "规则",
  settings: "设置",
};

const EASE = [0.16, 1, 0.3, 1] as const;

function IconButton({
  title,
  icon,
  active,
  onClick,
}: {
  title: string;
  icon: ReactNode;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <Tooltip title={title} placement="bottom">
      <Button
        type="text"
        size="small"
        aria-label={title}
        aria-pressed={active}
        className={active ? "is-active" : undefined}
        icon={icon}
        onClick={onClick}
      />
    </Tooltip>
  );
}

function Shell() {
  const { snapshot, settings, rules, undos, renameTabId, setRenameTabId, refresh } = useSnapshot();
  const [editingGroup, setEditingGroup] = useState<GroupSnapshot | null>(null);
  const [groupTitle, setGroupTitle] = useState("");
  const [panel, setPanel] = useState<Panel | null>(null);
  const reduceMotion = useReducedMotion();

  const renameTab: TabSnapshot | null = useMemo(() => {
    if (!snapshot || renameTabId == null) return null;
    return snapshot.tabs.find((tab) => tab.id === renameTabId) ?? null;
  }, [snapshot, renameTabId]);

  const togglePanel = (next: Panel) => {
    setPanel((current) => (current === next ? null : next));
  };

  return (
    <div className="app-shell">
      <header className="app-bar">
        <IconButton
          title="工作区"
          icon={<ApartmentOutlined />}
          active={panel === "workspace"}
          onClick={() => togglePanel("workspace")}
        />
        <IconButton
          title="规则"
          icon={<SlidersOutlined />}
          active={panel === "rules"}
          onClick={() => togglePanel("rules")}
        />
        <span className="app-bar-spacer" />
        <IconButton
          title="设置"
          icon={<SettingOutlined />}
          active={panel === "settings"}
          onClick={() => togglePanel("settings")}
        />
      </header>

      <main className="app-stage">
        <ChatPane
          settings={settings}
          snapshot={snapshot}
          hasRules={rules.length > 0}
          onRefresh={() => void refresh()}
          onOpenSettings={() => setPanel("settings")}
        />

        <AnimatePresence>
          {panel ? (
            <motion.section
              key={panel}
              className="stage-sheet"
              aria-label={PANEL_TITLE[panel]}
              initial={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 16 }}
              transition={{ duration: reduceMotion ? 0.12 : 0.24, ease: EASE }}
            >
            <header className="stage-sheet-bar">
              <Button
                type="text"
                size="small"
                icon={<LeftOutlined />}
                aria-label="返回对话"
                onClick={() => setPanel(null)}
              />
              <h2>{PANEL_TITLE[panel]}</h2>
            </header>
            <div className="stage-sheet-body">
              {panel === "workspace" ? (
                snapshot ? (
                  <Workbench
                    snapshot={snapshot}
                    onRename={(tab) => {
                      setRenameTabId(tab.id);
                      setPanel(null);
                    }}
                    onRenameGroup={(group) => {
                      setEditingGroup(group);
                      setGroupTitle(group.title);
                    }}
                    onRefresh={() => void refresh()}
                  />
                ) : (
                  "正在读取标签…"
                )
              ) : null}
              {panel === "rules" ? (
                <RulesPane rules={rules} undos={undos} onRefresh={() => void refresh()} />
              ) : null}
              {panel === "settings" ? (
                <SettingsPane settings={settings} onRefresh={() => void refresh()} />
              ) : null}
            </div>
            </motion.section>
          ) : null}
        </AnimatePresence>
      </main>

      <RenameModal
        tab={renameTab}
        groups={snapshot?.groups ?? []}
        onClose={() => setRenameTabId(null)}
        onSaved={() => void refresh()}
      />

      <Modal
        open={Boolean(editingGroup)}
        title="修改标签组"
        onCancel={() => setEditingGroup(null)}
        onOk={async () => {
          if (!editingGroup) return;
          await send({ type: "RENAME_GROUP", groupId: editingGroup.id, title: groupTitle });
          setEditingGroup(null);
          void refresh();
        }}
        okText="保存"
      >
        <Input value={groupTitle} onChange={(event) => setGroupTitle(event.target.value)} />
      </Modal>
    </div>
  );
}

export function App() {
  return (
    <XProvider locale={zhCN} theme={appTheme}>
      <AntdApp className="app-root">
        <Shell />
      </AntdApp>
    </XProvider>
  );
}
