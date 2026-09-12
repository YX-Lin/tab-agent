import {
  NATIVE_HOST_NAME,
  PROTOCOL_VERSION,
  type ExtensionToNative,
  type McpStatus,
  type NativeToExtension,
} from "@tab-title-agent/shared";
import { callTool } from "./tools-runtime";
import { getSettings } from "./storage";

type BridgeState = {
  nativeConnected: boolean;
  relaySeen: boolean;
  lastError?: string;
};

const state: BridgeState = {
  nativeConnected: false,
  relaySeen: false,
};

let port: chrome.runtime.Port | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connecting = false;
let stopRequested = false;

export function getMcpStatus(): McpStatus {
  return {
    mcpEnabled: false,
    nativeConnected: state.nativeConnected,
    relaySeen: state.relaySeen,
    protocolVersion: PROTOCOL_VERSION,
    extensionId: chrome.runtime.id,
    hostName: NATIVE_HOST_NAME,
    lastError: state.lastError,
  };
}

export async function getMcpStatusWithSettings(): Promise<McpStatus> {
  const settings = await getSettings();
  return { ...getMcpStatus(), mcpEnabled: settings.mcpEnabled };
}

export async function syncMcpBridge() {
  const settings = await getSettings();
  if (!settings.mcpEnabled) {
    disconnect();
    state.lastError = undefined;
    return;
  }
  connectNative();
}

function disconnect(reason?: string) {
  stopRequested = true;
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  connecting = false;
  state.nativeConnected = false;
  state.relaySeen = false;
  if (reason) state.lastError = reason;
  try {
    port?.disconnect();
  } catch {
    /* already gone */
  }
  port = null;
}

function scheduleReconnect() {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void syncMcpBridge();
  }, 3000);
}

function connectNative() {
  if (connecting || port) return;
  stopRequested = false;
  connecting = true;
  try {
    port = chrome.runtime.connectNative(NATIVE_HOST_NAME);
  } catch (error) {
    connecting = false;
    state.nativeConnected = false;
    state.lastError = error instanceof Error ? error.message : String(error);
    scheduleReconnect();
    return;
  }

  port.onMessage.addListener((message) => {
    void onNativeMessage(message as NativeToExtension);
  });

  port.onDisconnect.addListener(() => {
    const error = chrome.runtime.lastError?.message;
    port = null;
    connecting = false;
    state.nativeConnected = false;
    state.relaySeen = false;
    if (stopRequested) return;
    state.lastError = error || "Native Host 已断开";
    scheduleReconnect();
  });

  const hello: ExtensionToNative = {
    type: "hello",
    protocolVersion: PROTOCOL_VERSION,
    extensionId: chrome.runtime.id,
  };
  port.postMessage(hello);
  connecting = false;
  state.nativeConnected = true;
  state.lastError = undefined;
}

async function onNativeMessage(message: NativeToExtension) {
  if (!port) return;
  if (message.type === "hello_ok") {
    if (message.protocolVersion !== PROTOCOL_VERSION) {
      state.lastError = `协议版本不一致：扩展 v${PROTOCOL_VERSION}，Host v${message.protocolVersion}`;
    }
    return;
  }
  if (message.type === "ping") {
    const pong: ExtensionToNative = { type: "pong", at: message.at };
    port.postMessage(pong);
    return;
  }
  if (message.type === "relay") {
    state.relaySeen = true;
    if (message.protocolVersion !== PROTOCOL_VERSION) {
      state.lastError = `中继协议版本不一致：扩展 v${PROTOCOL_VERSION}，中继 v${message.protocolVersion}`;
    } else {
      state.lastError = undefined;
    }
    return;
  }
  if (message.type === "relay_down") {
    state.relaySeen = false;
    return;
  }
  if (message.type === "call_tool") {
    const settings = await getSettings();
    if (!settings.mcpEnabled) {
      const denied: ExtensionToNative = {
        type: "tool_result",
        id: message.id,
        ok: false,
        error: "设置里已关闭 MCP 连接",
      };
      port.postMessage(denied);
      return;
    }
    try {
      const result = await callTool(message.name, message.args ?? {}, { source: "mcp" });
      const ok = !(
        result &&
        typeof result === "object" &&
        "ok" in result &&
        (result as { ok?: unknown }).ok === false
      );
      const reply: ExtensionToNative = ok
        ? { type: "tool_result", id: message.id, ok: true, result }
        : {
            type: "tool_result",
            id: message.id,
            ok: false,
            error:
              result && typeof result === "object" && "error" in result
                ? String((result as { error?: unknown }).error ?? "工具调用失败")
                : "工具调用失败",
          };
      port.postMessage(reply);
    } catch (error) {
      const reply: ExtensionToNative = {
        type: "tool_result",
        id: message.id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
      port.postMessage(reply);
    }
  }
}
