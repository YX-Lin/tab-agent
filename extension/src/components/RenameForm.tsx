import { Button, Flex, Form, Input, Select, message } from "antd";
import {
  ROLE_IDS,
  ROLE_LABELS,
  stripRolePrefix,
  withRolePrefix,
  type RoleId,
  type TabSnapshot,
} from "@tab-title-agent/shared";
import { useEffect, useState } from "react";
import { send } from "../lib/messages";

type Props = {
  tab: TabSnapshot;
  groups: { id: number; title: string }[];
  onCancel: () => void;
  onDone: () => void;
};

export function RenameForm({ tab, groups, onCancel, onDone }: Props) {
  const [role, setRole] = useState<RoleId>("other");
  const [title, setTitle] = useState("");
  const [groupId, setGroupId] = useState<number | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRole(tab.role ?? "other");
    setTitle(stripRolePrefix(tab.customTitle ?? tab.title));
    setGroupId(tab.groupId > 0 ? tab.groupId : undefined);
  }, [tab]);

  const save = async () => {
    setSaving(true);
    try {
      const nextTitle = role === "other" ? title.trim() : withRolePrefix(ROLE_LABELS[role], title);
      await send({ type: "SET_TITLE", tabId: tab.id, title: nextTitle, role, recordHabit: true });
      if (groupId && groupId !== tab.groupId) {
        await send({ type: "MOVE_TO_GROUP", tabIds: [tab.id], groupId, recordHabit: true });
      }
      message.success("已更新标题");
      onDone();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Form layout="vertical">
      <Form.Item label="角色">
        <Select
          value={role}
          onChange={setRole}
          options={ROLE_IDS.map((id) => ({ value: id, label: ROLE_LABELS[id] }))}
        />
      </Form.Item>
      <Form.Item label="标题">
        <Input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          onPressEnter={() => void save()}
          autoFocus
        />
      </Form.Item>
      <Form.Item label="标签组">
        <Select
          allowClear
          placeholder="保持原组"
          value={groupId}
          onChange={setGroupId}
          options={groups.map((group) => ({ value: group.id, label: group.title }))}
        />
      </Form.Item>
      <Flex justify="space-between" gap={8} wrap="wrap">
        <Button
          onClick={async () => {
            await send({ type: "RESTORE_TITLE", tabId: tab.id });
            onDone();
          }}
        >
          恢复原标题
        </Button>
        <Flex gap={8}>
          <Button onClick={onCancel}>取消</Button>
          <Button type="primary" loading={saving} onClick={() => void save()}>
            保存
          </Button>
        </Flex>
      </Flex>
    </Form>
  );
}
