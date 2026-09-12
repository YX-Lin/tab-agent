import { Alert, Button, Empty, Flex, Input, List, Modal, Space, Switch, Tag, message } from "antd";
import { useState } from "react";
import type { OrganizeRule } from "@tab-title-agent/shared";
import { describeRule } from "@tab-title-agent/shared";
import { send } from "../../lib/messages";

type Props = {
  rules: OrganizeRule[];
  undos: { summary: string }[];
  onRefresh: () => void;
};

export function RulesPane({ rules, undos, onRefresh }: Props) {
  const [utterance, setUtterance] = useState("");
  const [preview, setPreview] = useState<{ tabId: number; from: string; to: string }[] | null>(null);
  const [pending, setPending] = useState<OrganizeRule | null>(null);

  const compile = async () => {
    const result = await send<{ ok: boolean; rule?: OrganizeRule; reason?: string }>({
      type: "COMPILE_RULE",
      utterance,
    });
    if (!result.ok || !result.rule) {
      message.warning(result.reason ?? "无法编译这条规则");
      return;
    }
    const hits = await send<{ tabId: number; from: string; to: string }[]>({
      type: "PREVIEW_RULE",
      utterance,
    });
    setPending(result.rule);
    setPreview(Array.isArray(hits) ? hits : []);
  };

  return (
    <Flex vertical gap={12}>
      <Flex wrap="wrap" gap={8}>
        <Button size="small" onClick={() => void send({ type: "PROMOTE_HABITS" }).then(onRefresh)}>
          按习惯更新
        </Button>
        <Button size="small" onClick={() => void send({ type: "UNDO_LEARNED" }).then(onRefresh)}>
          撤销习惯更新
        </Button>
      </Flex>
      {undos.at(-1) ? <Alert type="info" showIcon message={undos.at(-1)?.summary} /> : null}

      <Space.Compact style={{ width: "100%" }}>
        <Input
          value={utterance}
          placeholder="例如：figma 都算视觉稿，进当前组"
          onChange={(event) => setUtterance(event.target.value)}
          onPressEnter={() => void compile()}
        />
        <Button type="primary" onClick={() => void compile()}>
          编译
        </Button>
      </Space.Compact>

      <List
        size="small"
        locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="还没有规则" /> }}
        dataSource={[...rules].sort((a, b) => b.priority - a.priority)}
        renderItem={(rule) => (
          <List.Item
            actions={[
              <Switch
                key="on"
                size="small"
                checked={rule.enabled}
                onChange={(enabled) =>
                  void send({ type: "TOGGLE_RULE", id: rule.id, enabled }).then(onRefresh)
                }
              />,
              <Button
                key="del"
                size="small"
                type="link"
                danger
                onClick={() => void send({ type: "DELETE_RULE", id: rule.id }).then(onRefresh)}
              >
                删除
              </Button>,
            ]}
          >
            <List.Item.Meta
              title={
                <Space size={6}>
                  <span>{rule.utterance}</span>
                  <Tag className="tta-chip">{rule.source === "learned" ? "习惯" : rule.source === "manual" ? "手动" : "编译"}</Tag>
                </Space>
              }
              description={describeRule(rule)}
            />
          </List.Item>
        )}
      />

      <Modal
        open={Boolean(pending)}
        title="预览规则"
        onCancel={() => {
          setPending(null);
          setPreview(null);
        }}
        onOk={async () => {
          if (!pending) return;
          await send({ type: "UPSERT_RULE", rule: pending });
          await send({ type: "APPLY_RULES" });
          setPending(null);
          setPreview(null);
          setUtterance("");
          onRefresh();
        }}
        okText="保存并套用"
      >
        {preview?.length ? (
          <List
            size="small"
            dataSource={preview}
            renderItem={(item) => (
              <List.Item>
                {item.from} → {item.to}
              </List.Item>
            )}
          />
        ) : (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="当前窗口没有命中的标签，仍可保存供以后使用。" />
        )}
      </Modal>
    </Flex>
  );
}
