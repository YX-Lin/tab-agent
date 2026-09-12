import {
  PROTOCOL_VERSION,
  type ExtensionToNative,
  type NativeToExtension,
  type RelayHello,
  type RelayPortFile,
} from "@tab-title-agent/shared";
import { createNativeMessaging } from "./nm";
import { isPidAlive, readRelayPort } from "./paths";

type HostWebSocket = WebSocket;

function isExtensionMessage(value: unknown): value is ExtensionToNative {
  if (!value || typeof value !== "object" || !("type" in value)) return false;
  const type = (value as { type: unknown }).type;
  return type === "hello" || type === "pong" || type === "tool_result";
}

function connectRelay(file: RelayPortFile, sendToChrome: (message: NativeToExtension) => void) {
  const url = new URL(file.url);
  url.searchParams.set("token", file.token);
  const socket = new WebSocket(url.toString());
  let opened = false;

  socket.addEventListener("open", () => {
    opened = true;
    const hello: RelayHello = {
      type: "hello",
      protocolVersion: PROTOCOL_VERSION,
      role: "native-host",
    };
    socket.send(JSON.stringify(hello));
    sendToChrome({
      type: "relay",
      url: file.url,
      protocolVersion: file.protocolVersion,
    });
  });

  socket.addEventListener("message", (event) => {
    try {
      const parsed = JSON.parse(String(event.data)) as NativeToExtension;
      sendToChrome(parsed);
    } catch (error) {
      process.stderr.write(`[tab-agent host] bad relay payload: ${String(error)}\n`);
    }
  });

  socket.addEventListener("close", () => {
    if (opened) sendToChrome({ type: "relay_down" });
  });

  socket.addEventListener("error", () => {
    /* close handler reports disconnect */
  });

  return socket;
}

function main() {
  const nm = createNativeMessaging();
  let socket: HostWebSocket | null = null;
  let lastKey = "";

  const sendToChrome = (message: NativeToExtension) => nm.send(message);

  nm.onMessage((message) => {
    if (!isExtensionMessage(message)) return;
    if (message.type === "hello") {
      sendToChrome({ type: "hello_ok", protocolVersion: PROTOCOL_VERSION });
      return;
    }
    if (message.type === "pong") return;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  });

  const syncRelay = () => {
    const file = readRelayPort();
    const usable =
      file &&
      file.protocolVersion === PROTOCOL_VERSION &&
      isPidAlive(file.pid)
        ? file
        : null;
    const nextKey = usable ? `${usable.pid}:${usable.url}:${usable.token}` : "";
    const stillUp =
      socket &&
      (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING);
    if (nextKey === lastKey && stillUp) return;

    if (socket) {
      socket.close();
      socket = null;
    }

    if (!usable) {
      if (lastKey) sendToChrome({ type: "relay_down" });
      lastKey = "";
      return;
    }

    lastKey = nextKey;
    socket = connectRelay(usable, sendToChrome);
  };

  setInterval(syncRelay, 1000);
  setInterval(() => sendToChrome({ type: "ping", at: Date.now() }), 15_000);
  syncRelay();
}

main();
