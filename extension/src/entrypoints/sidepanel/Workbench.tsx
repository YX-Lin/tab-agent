import {
  Button,
  Checkbox,
  Dropdown,
  Empty,
  Flex,
  Input,
  Modal,
  Typography,
  message,
} from "antd";
import {
  CaretRightOutlined,
  EditOutlined,
  LockOutlined,
  MoreOutlined,
} from "@ant-design/icons";
import {
  ROLE_COLORS,
  ROLE_LABELS,
  hostOf,
  type GroupSnapshot,
  type TabSnapshot,
  type WindowSnapshot,
} from "@tab-title-agent/shared";
import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { send } from "../../lib/messages";

type Props = {
  snapshot: WindowSnapshot;
  onRename: (tab: TabSnapshot) => void;
  onRenameGroup: (group: GroupSnapshot) => void;
  onRefresh: () => void;
};

const GROUP_COLORS: Record<string, string> = {
  grey: "#9aa0a6",
  blue: "#1a73e8",
  red: "#d93025",
  yellow: "#f9ab00",
  green: "#188038",
  pink: "#d01884",
  purple: "#a142f4",
  cyan: "#007b83",
};

function displayUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (/^(chrome|edge|about|devtools):$/i.test(url.protocol)) {
      return raw.replace(/\/$/, "");
    }
    const host = url.hostname.replace(/^www\./, "");
    let path = url.pathname;
    if (path === "/") path = "";
    else if (path.length > 28) path = `${path.slice(0, 28)}…`;
    return `${host}${path}`;
  } catch {
    return raw;
  }
}

function TabFavicon({ tab }: { tab: TabSnapshot }) {
  const [broken, setBroken] = useState(false);
  const host = hostOf(tab.url);
  const letter = (host || tab.title || "?").slice(0, 1).toUpperCase();
  if (!tab.favIconUrl || broken) {
    return (
      <span className="tab-favicon is-fallback" aria-hidden>
        {letter}
      </span>
    );
  }
  return (
    <img
      className="tab-favicon"
      src={tab.favIconUrl}
      alt=""
      onError={() => setBroken(true)}
    />
  );
}

function TabRow({
  tab,
  selected,
  onToggle,
  onRename,
  onActivate,
}: {
  tab: TabSnapshot;
  selected: boolean;
  onToggle: (tabId: number, checked: boolean) => void;
  onRename: (tab: TabSnapshot) => void;
  onActivate: (tab: TabSnapshot) => void;
}) {
  const roleColor = tab.role ? ROLE_COLORS[tab.role] : undefined;

  return (
    <div
      className={[
        "workspace-tab",
        tab.active ? "is-active" : "",
        selected ? "is-selected" : "",
        tab.unsupported ? "is-restricted" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <Checkbox
        checked={selected}
        aria-label={`选择 ${tab.title || tab.url}`}
        onClick={(event) => event.stopPropagation()}
        onChange={(event) => onToggle(tab.id, event.target.checked)}
      />
      <button
        type="button"
        className="workspace-tab-main"
        onClick={() => onActivate(tab)}
        title="切换到此标签"
      >
        <TabFavicon tab={tab} />
        <span className="workspace-tab-copy">
          <span className="workspace-tab-title">
            <span className="workspace-tab-name">{tab.title || tab.url}</span>
            {tab.locked ? <LockOutlined className="workspace-tab-lock" /> : null}
          </span>
          <span className="workspace-tab-url">{displayUrl(tab.url)}</span>
        </span>
      </button>
      {tab.role ? (
        <span
          className="tta-chip"
          style={
            roleColor
              ? ({
                  "--chip-fg": roleColor,
                  "--chip-bg": `${roleColor}18`,
                } as CSSProperties)
              : undefined
          }
        >
          {ROLE_LABELS[tab.role]}
        </span>
      ) : null}
      <button
        type="button"
        className="workspace-tab-rename"
        aria-label="改名"
        title="改名"
        onClick={() => onRename(tab)}
      >
        <EditOutlined />
      </button>
    </div>
  );
}

function TabSection({
  sectionKey,
  title,
  color,
  isActive,
  tabs,
  selectedSet,
  collapsed,
  emptyText,
  onToggleCollapsed,
  onToggleTab,
  onToggleSection,
  onRename,
  onActivate,
  extra,
}: {
  sectionKey: string;
  title: string;
  color?: string;
  isActive?: boolean;
  tabs: TabSnapshot[];
  selectedSet: Set<number>;
  collapsed: boolean;
  emptyText: string;
  onToggleCollapsed: (key: string) => void;
  onToggleTab: (tabId: number, checked: boolean) => void;
  onToggleSection: (tabIds: number[], checked: boolean) => void;
  onRename: (tab: TabSnapshot) => void;
  onActivate: (tab: TabSnapshot) => void;
  extra?: ReactNode;
}) {
  const ids = tabs.map((tab) => tab.id);
  const selectedCount = ids.filter((id) => selectedSet.has(id)).length;
  const allSelected = ids.length > 0 && selectedCount === ids.length;
  const mixed = selectedCount > 0 && !allSelected;

  return (
    <section
      className={["workspace-section", isActive ? "is-current" : ""].filter(Boolean).join(" ")}
      style={color ? { ["--group-color" as string]: color } : undefined}
    >
      <header className="workspace-section-head">
        <button
          type="button"
          className="workspace-section-toggle"
          aria-expanded={!collapsed}
          onClick={() => onToggleCollapsed(sectionKey)}
        >
          <CaretRightOutlined className={collapsed ? "caret" : "caret is-open"} />
          {color ? <span className="workspace-section-dot" aria-hidden /> : null}
          <span className="workspace-section-title">{title}</span>
          <span className="workspace-section-count">{tabs.length}</span>
          {isActive ? <span className="workspace-section-pill">当前</span> : null}
        </button>
        <div className="workspace-section-tools" onClick={(event) => event.stopPropagation()}>
          {ids.length ? (
            <Checkbox
              checked={allSelected}
              indeterminate={mixed}
              aria-label={`全选 ${title}`}
              onChange={(event) => onToggleSection(ids, event.target.checked)}
            />
          ) : null}
          {extra}
        </div>
      </header>
      {collapsed ? null : tabs.length ? (
        <div className="workspace-section-body">
          {tabs.map((tab) => (
            <TabRow
              key={tab.id}
              tab={tab}
              selected={selectedSet.has(tab.id)}
              onToggle={onToggleTab}
              onRename={onRename}
              onActivate={onActivate}
            />
          ))}
        </div>
      ) : (
        <div className="workspace-section-empty">{emptyText}</div>
      )}
    </section>
  );
}

export function Workbench({ snapshot, onRename, onRenameGroup, onRefresh }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  const toggle = (tabId: number, checked: boolean) => {
    setSelected((current) =>
      checked ? [...new Set([...current, tabId])] : current.filter((id) => id !== tabId),
    );
  };

  const toggleSection = (tabIds: number[], checked: boolean) => {
    setSelected((current) => {
      if (checked) return [...new Set([...current, ...tabIds])];
      const drop = new Set(tabIds);
      return current.filter((id) => !drop.has(id));
    });
  };

  const toggleCollapsed = (key: string) => {
    setCollapsed((current) => ({ ...current, [key]: !current[key] }));
  };

  const activate = async (tab: TabSnapshot) => {
    await send({ type: "ACTIVATE_TAB", tabId: tab.id });
    onRefresh();
  };

  const createGroup = async () => {
    const tabIds = selected.length ? selected : snapshot.ungrouped.map((tab) => tab.id);
    if (!tabIds.length) {
      message.warning("先勾选标签，或把未分组的标签收成一组");
      return;
    }
    await send({ type: "CREATE_GROUP", title: groupName.trim() || "未命名分组", tabIds });
    setCreating(false);
    setGroupName("");
    setSelected([]);
    onRefresh();
  };

  const moveToActive = async () => {
    if (!snapshot.activeGroupId || !selected.length) return;
    await send({
      type: "MOVE_TO_GROUP",
      tabIds: selected,
      groupId: snapshot.activeGroupId,
      recordHabit: true,
    });
    setSelected([]);
    onRefresh();
  };

  const ungroup = async () => {
    if (!selected.length) return;
    await send({ type: "UNGROUP", tabIds: selected });
    setSelected([]);
    onRefresh();
  };

  const summary = selected.length
    ? `已选 ${selected.length}`
    : snapshot.ungrouped.length
      ? `${snapshot.tabs.length} 个标签 · ${snapshot.ungrouped.length} 个未分组`
      : `${snapshot.tabs.length} 个标签 · ${snapshot.groups.length} 个组`;

  if (!snapshot.tabs.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="这个窗口还没有标签" />;
  }

  return (
    <div className="workspace">
      <div className="workspace-toolbar">
        <Typography.Text type="secondary" className="workspace-summary">
          {summary}
        </Typography.Text>
        <Flex gap={6}>
          <Button size="small" onClick={() => void send({ type: "APPLY_RULES" }).then(onRefresh)}>
            套用规则
          </Button>
          <Button size="small" type="primary" onClick={() => setCreating(true)}>
            收成一组
          </Button>
        </Flex>
      </div>

      <div className="workspace-scroll">
        {snapshot.groups.map((group) => (
          <TabSection
            key={group.id}
            sectionKey={String(group.id)}
            title={group.title || "未命名分组"}
            color={GROUP_COLORS[group.color] ?? GROUP_COLORS.grey}
            isActive={group.isActive}
            tabs={snapshot.tabs.filter((tab) => tab.groupId === group.id)}
            selectedSet={selectedSet}
            collapsed={Boolean(collapsed[String(group.id)])}
            emptyText="这个组还没有标签"
            onToggleCollapsed={toggleCollapsed}
            onToggleTab={toggle}
            onToggleSection={toggleSection}
            onRename={onRename}
            onActivate={activate}
            extra={
              <Dropdown
                trigger={["click"]}
                menu={{
                  items: [
                    {
                      key: "rename",
                      label: "改名",
                      onClick: () => onRenameGroup(group),
                    },
                    {
                      key: "active",
                      label: "设为当前组",
                      disabled: group.isActive,
                      onClick: () =>
                        void send({
                          type: "SET_ACTIVE",
                          windowId: snapshot.windowId,
                          groupId: group.id,
                        }).then(onRefresh),
                    },
                  ],
                }}
              >
                <Button type="text" size="small" icon={<MoreOutlined />} aria-label={`${group.title} 更多`} />
              </Dropdown>
            }
          />
        ))}

        {snapshot.ungrouped.length || !snapshot.groups.length ? (
          <TabSection
            sectionKey="ungrouped"
            title="未分组"
            tabs={snapshot.ungrouped}
            selectedSet={selectedSet}
            collapsed={Boolean(collapsed.ungrouped)}
            emptyText="没有未分组标签"
            onToggleCollapsed={toggleCollapsed}
            onToggleTab={toggle}
            onToggleSection={toggleSection}
            onRename={onRename}
            onActivate={activate}
          />
        ) : null}
      </div>

      {selected.length ? (
        <div className="workspace-dock">
          <span className="workspace-dock-count">已选 {selected.length}</span>
          <Button size="small" disabled={!snapshot.activeGroupId} onClick={() => void moveToActive()}>
            移入当前组
          </Button>
          <Button size="small" onClick={() => void ungroup()}>
            移出
          </Button>
          <Button size="small" type="text" onClick={() => setSelected([])}>
            取消
          </Button>
        </div>
      ) : null}

      <Modal
        open={creating}
        title="新建标签组"
        onCancel={() => setCreating(false)}
        onOk={() => void createGroup()}
        okText="创建"
      >
        <Flex vertical gap={8}>
          <Typography.Text type="secondary">
            {selected.length
              ? `将把已勾选的 ${selected.length} 个标签收进该组`
              : "未勾选时，会把当前窗口未分组标签收进该组"}
          </Typography.Text>
          <Input
            placeholder="分组名称"
            value={groupName}
            onChange={(event) => setGroupName(event.target.value)}
            onPressEnter={() => void createGroup()}
            autoFocus
          />
        </Flex>
      </Modal>
    </div>
  );
}
