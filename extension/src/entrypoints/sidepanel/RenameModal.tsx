import { Modal } from "antd";
import type { TabSnapshot } from "@tab-title-agent/shared";
import { RenameForm } from "../../components/RenameForm";

type Props = {
  tab: TabSnapshot | null;
  groups: { id: number; title: string }[];
  onClose: () => void;
  onSaved: () => void;
};

export function RenameModal({ tab, groups, onClose, onSaved }: Props) {
  return (
    <Modal
      open={Boolean(tab)}
      title="修改标签"
      onCancel={onClose}
      footer={null}
      destroyOnClose
    >
      {tab ? (
        <RenameForm
          tab={tab}
          groups={groups}
          onCancel={onClose}
          onDone={() => {
            onSaved();
            onClose();
          }}
        />
      ) : null}
    </Modal>
  );
}
