import { Bubble, Sender } from "@ant-design/x";
import { XMarkdown } from "@ant-design/x-markdown";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AGENT_SYSTEM_PROMPT,
  TOOL_DEFINITIONS,
  type ExtensionSettings,
  type WindowSnapshot,
} from "@tab-title-agent/shared";
import { send } from "../../lib/messages";
import { HomeEmpty } from "./HomeEmpty";
import { buildHomeModel } from "./homeModel";

type ChatMessage = {
  key: string;
  role: "user" | "ai" | "system";
  content: string;
};

type Props = {
  settings: ExtensionSettings;
  snapshot: WindowSnapshot | null;
  hasRules: boolean;
  onRefresh: () => void;
  onOpenSettings: () => void;
};

const CHAT_ROLES = {
  user: {
    placement: "end" as const,
    variant: "filled" as const,
    shape: "round" as const,
    classNames: { content: "bubble-user" },
  },
  ai: {
    placement: "start" as const,
    variant: "filled" as const,
    shape: "corner" as const,
    classNames: { content: "bubble-ai" },
  },
};

const EASE = [0.16, 1, 0.3, 1] as const;

function renderAiMarkdown(content: unknown) {
  return (
    <XMarkdown
      className="x-markdown-light"
      content={typeof content === "string" ? content : String(content ?? "")}
      openLinksInNewTab
      escapeRawHtml
    />
  );
}

async function complete(
  settings: ExtensionSettings,
  messages: { role: string; content?: string; tool_calls?: unknown; tool_call_id?: string; name?: string }[],
) {
  const base = settings.apiBaseUrl.replace(/\/$/, "");
  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${settings.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: settings.model,
      messages,
      tools: TOOL_DEFINITIONS,
    }),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `HTTP ${response.status}`);
  }
  const json = await response.json();
  return json.choices?.[0]?.message as {
    role: string;
    content?: string;
    tool_calls?: {
      id: string;
      function: { name: string; arguments: string };
    }[];
  };
}

export function ChatPane({ settings, snapshot, hasRules, onRefresh, onOpenSettings }: Props) {
  const [items, setItems] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  const ready = Boolean(settings.apiKey);
  const isHome = items.length === 0 && !loading;
  const home = useMemo(
    () => buildHomeModel(snapshot, settings, hasRules),
    [snapshot, settings, hasRules],
  );

  const run = async (text: string) => {
    if (!text.trim() || loading) return;
    if (!ready) {
      setInput(text.trim());
      onOpenSettings();
      return;
    }

    const userMessage = { key: crypto.randomUUID(), role: "user" as const, content: text };
    setItems((current) => [...current, userMessage]);
    setInput("");
    setLoading(true);

    const history: {
      role: string;
      content?: string;
      tool_calls?: unknown;
      tool_call_id?: string;
      name?: string;
    }[] = [
      { role: "system", content: AGENT_SYSTEM_PROMPT },
      ...items.map((item) => ({
        role: item.role === "ai" ? "assistant" : "user",
        content: item.content,
      })),
      { role: "user", content: text },
    ];

    try {
      for (let step = 0; step < 8; step += 1) {
        const message = await complete(settings, history);
        if (message.tool_calls?.length) {
          history.push({
            role: "assistant",
            content: message.content ?? "",
            tool_calls: message.tool_calls,
          });
          for (const call of message.tool_calls) {
            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(call.function.arguments || "{}");
            } catch {
              args = {};
            }
            const result = await send({ type: "CALL_TOOL", name: call.function.name, args });
            history.push({
              role: "tool",
              tool_call_id: call.id,
              name: call.function.name,
              content: JSON.stringify(result),
            });
          }
          continue;
        }
        setItems((current) => [
          ...current,
          {
            key: crypto.randomUUID(),
            role: "ai",
            content: message.content?.trim() || "已处理。",
          },
        ]);
        onRefresh();
        break;
      }
    } catch (error) {
      setItems((current) => [
        ...current,
        {
          key: crypto.randomUUID(),
          role: "ai",
          content: error instanceof Error ? error.message : String(error),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const bubbles = useMemo(
    () => [
      ...items.map((item) => ({
        key: item.key,
        role: (item.role === "user" ? "user" : "ai") as "user" | "ai",
        content: item.content,
        loading: false,
      })),
      ...(loading ? [{ key: "pending", role: "ai" as const, content: "", loading: true }] : []),
    ],
    [items, loading],
  );

  useEffect(() => {
    const node = logRef.current;
    if (!node) return;
    node.scrollTo({
      top: node.scrollHeight,
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [bubbles, reduceMotion]);

  const composer = (
    <Sender
      value={input}
      onChange={setInput}
      onSubmit={() => void run(input)}
      loading={loading}
      autoSize={{ minRows: 1, maxRows: 4 }}
      placeholder={isHome ? home.placeholder : "分组、改标题，直接说"}
    />
  );

  if (isHome) {
    return (
      <div className="chat-pane is-home">
        <HomeEmpty
          model={home}
          composer={composer}
          onPrompt={(item) => void run(item.prompt)}
          onOpenSettings={onOpenSettings}
        />
      </div>
    );
  }

  return (
    <div className="chat-pane">
      <div className="chat-log" ref={logRef}>
        <div className="chat-log-spacer" />
        <AnimatePresence initial={false}>
          {bubbles.map((item) => {
            const role = CHAT_ROLES[item.role];
            return (
              <motion.div
                key={item.key}
                className={`bubble-row bubble-row-${item.role}`}
                initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: reduceMotion ? 0.12 : 0.28, ease: EASE }}
              >
                <Bubble
                  content={item.content}
                  loading={item.loading}
                  placement={role.placement}
                  variant={role.variant}
                  shape={role.shape}
                  classNames={role.classNames}
                  messageRender={item.role === "ai" && !item.loading ? renderAiMarkdown : undefined}
                />
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
      <div className="chat-dock">{composer}</div>
    </div>
  );
}
