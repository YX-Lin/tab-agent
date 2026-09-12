import {
  Button,
  Checkbox,
  Collapse,
  Dropdown,
  Empty,
  Flex,
  Input,
  List,
  Modal,
  Space,
  Tag,
  Typography,
  message,
} from "antd";
import { LockOutlined, MoreOutlined } from "@ant-design/icons";
import {
  ROLE_LABELS,
  type GroupSnapshot,
  type TabSnapshot,
  type WindowSnapshot,
} from "@tab-title-agent/shared";
import { useMemo, useState } from "react";
import { send } from "../../lib/messages";

type Props = {
  snapshot: WindowSnapshot;
  onRename: (tab: TabSnapshot) => void;
  onRenameGroup: (group: GroupSnapshot) => void;
  onRefresh: () => void;
};

function TabList({
  tabs,
  selectedSet,
  onToggle,
  onRename,
  emptyText,
}: {
  tabs: TabSnapshot[];
  selectedSet: Set<number>;
  onToggle: (tabId: number, checked: boolean) => void;
  onRename: (tab: TabSnapshot) => void;
  emptyText: string;
}) {
  if (!tabs.length) {
    return <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={emptyText} />;
  }

  return (
    <List
      className="workspace-list"
      size="small"
      dataSource={tabs}
      renderItem={(tab) => (
        <List.Item
          className={tab.active ? "ant-list-item-active" : undefined}
          onClick={() => onRename(tab)}
          actions={[
            tab.role ? (
              <Tag key="role" className="tta-chip">
                {ROLE_LABELS[tab.role]}
              </Tag>
            ) : null,
            tab.locked ? <LockOutlined key="lock" /> : null,
          ]}
        >
          <Flex align="center" gap={8} style={{ minWidth: 0, flex: 1 }}>
            <Checkbox
              checked={selectedSet.has(tab.id)}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onToggle(tab.id, event.target.checked)}
            />
            {tab.favIconUrl ? <img className="tab-favicon" src={tab.favIconUrl} alt="" /> : null}
            <List.Item.Meta
              title={tab.title || tab.url}
              description={
                <Typography.Text type="secondary" ellipsis>
                  {tab.url}
                </Typography.Text>
              }
            />
          </Flex>
        </List.Item>
      )}
    />
  );
}

export function Workbench({ snapshot, onRename, onRenameGroup, onRefresh }: Props) {
  const [selected, setSelected] = useState<number[]>([]);
  const [creating, setCreating] = useState(false);
  const [groupName, setGroupName] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const activeKey = snapshot.activeGroupId != null ? String(snapshot.activeGroupId) : "ungrouped";

  const toggle = (tabId: number, checked: boolean) => {
    setSelected((current) =>
      checked ? [...new Set([...current, tabId])] : current.filter((id) => id !== tabId),
    );
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

  const items = [
    {
      key: "create",
      label: "收成一组",
      onClick: () => setCreating(true),
    },
    {
      key: "move",
      label: "移入当前组",
      disabled: !selected.length || !snapshot.activeGroupId,
      onClick: async () => {
        if (!snapshot.activeGroupId) return;
        await send({
          type: "MOVE_TO_GROUP",
          tabIds: selected,
          groupId: snapshot.activeGroupId,
          recordHabit: true,
        });
        setSelected([]);
        onRefresh();
      },
    },
    {
      key: "ungroup",
      label: "移出分组",
      disabled: !selected.length,
      onClick: async () => {
        await send({ type: "UNGROUP", tabIds: selected });
        setSelected([]);
        onRefresh();
      },
    },
    {
      key: "apply",
      label: "套用规则",
      onClick: () => void send({ type: "APPLY_RULES" }).then(onRefresh),
    },
  ];

  return (
    <Flex vertical gap={12}>
      <Flex justify="space-between" align="center">
        <Typography.Text type="secondary">
          {selected.length ? `已选 ${selected.length}` : "点标签改名，勾选后可整理"}
        </Typography.Text>
        <Dropdown menu={{ items }} trigger={["click"]}>
          <Button type="text" icon={<MoreOutlined />} />
        </Dropdown>
      </Flex>

      <Collapse
        accordion
        ghost
        defaultActiveKey={[activeKey]}
        items={[
          ...snapshot.groups.map((group) => ({
            key: String(group.id),
            label: `${group.title}${group.isActive ? "  · 当前" : ""}`,
            extra: (
              <Space size={4} onClick={(event) => event.stopPropagation()}>
                <Button size="small" type="text" onClick={() => onRenameGroup(group)}>
                  改名
                </Button>
                {!group.isActive ? (
                  <Button
                    size="small"
                    type="text"
                    onClick={() =>
                      void send({
                        type: "SET_ACTIVE",
                        windowId: snapshot.windowId,
                        groupId: group.id,
                      }).then(onRefresh)
                    }
                  >
                    当前
                  </Button>
                ) : null}
              </Space>
            ),
            children: (
              <TabList
                tabs={snapshot.tabs.filter((tab) => tab.groupId === group.id)}
                selectedSet={selectedSet}
                onToggle={toggle}
                onRename={onRename}
                emptyText="这个组还没有标签"
              />
            ),
          })),
          {
            key: "ungrouped",
            label: `未分组 · ${snapshot.ungrouped.length}`,
            children: (
              <TabList
                tabs={snapshot.ungrouped}
                selectedSet={selectedSet}
                onToggle={toggle}
                onRename={onRename}
                emptyText="没有未分组标签"
              />
            ),
          },
        ]}
      />

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
          />
        </Flex>
      </Modal>
    </Flex>
  );
}
