import { createServer, type IncomingMessage, type Server } from "node:http";
import { randomBytes, randomUUID } from "node:crypto";
import { WebSocketServer, type WebSocket } from "ws";
import {
  PROTOCOL_VERSION,
  RELAY_PATH,
  type RelayPortFile,
} from "@tab-title-agent/shared";
import { ensureDataDir, isPidAlive, readRelayPort, relayPortPath } from "./paths";
import fs from "node:fs";

const TOOL_TIMEOUT_MS = 30_000;

type Pending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

export class ExtensionRelay {
  private server: Server | null = null;
  private wss: WebSocketServer | null = null;
  private socket: WebSocket | null = null;
  private pending = new Map<string, Pending>();
  private token = randomBytes(24).toString("hex");
  private port = 0;

  connected() {
    return this.socket?.readyState === 1;
  }

  async start() {
    const existing = readRelayPort();
    if (existing && isPidAlive(existing.pid) && existing.pid !== process.pid) {
      throw new Error(
        `已有 tab-agent mcp 在运行（pid ${existing.pid}）。先停掉那个进程再启动。`,
      );
    }

    ensureDataDir();
    this.server = createServer((req, res) => {
      if (req.url === "/health") {
        res.writeHead(200, { "content-type": "application/json" });
        res.end(
          JSON.stringify({
            ok: true,
            protocolVersion: PROTOCOL_VERSION,
            extensionConnected: this.connected(),
          }),
        );
        return;
      }
      res.writeHead(404);
      res.end();
    });

    this.wss = new WebSocketServer({ server: this.server, path: RELAY_PATH });
    this.wss.on("connection", (socket, request) => this.onConnection(socket, request));

    await new Promise<void>((resolve, reject) => {
      this.server!.once("error", reject);
      this.server!.listen(0, "127.0.0.1", () => resolve());
    });

    const address = this.server.address();
    if (!address || typeof address === "string") {
      throw new Error("无法绑定本机中继端口");
    }
    this.port = address.port;
    this.writeRelayFile();
    process.on("exit", () => this.removeRelayFile());
    process.stderr.write(
      `[tab-agent] 中继已监听 ws://127.0.0.1:${this.port}${RELAY_PATH}\n`,
    );
  }

  async callTool(name: string, args: Record<string, unknown>) {
    if (!this.connected() || !this.socket) {
      throw new Error(
        "Chrome 未连接。请先加载 Tab Agent 扩展，运行 `tab-agent install`，在设置里打开「允许外部 Agent 经 MCP 连接」，并保持 Chrome 运行。",
      );
    }

    const id = randomUUID();
    const payload = { type: "call_tool", id, name, args };
    return new Promise<unknown>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`调用 ${name} 超时`));
      }, TOOL_TIMEOUT_MS);
      this.pending.set(id, { resolve, reject, timer });
      this.socket!.send(JSON.stringify(payload));
    });
  }

  async close() {
    for (const item of this.pending.values()) {
      clearTimeout(item.timer);
      item.reject(new Error("MCP 进程已退出"));
    }
    this.pending.clear();
    this.socket?.close();
    this.socket = null;
    await new Promise<void>((resolve) => this.wss?.close(() => resolve()) ?? resolve());
    await new Promise<void>((resolve) => this.server?.close(() => resolve()) ?? resolve());
    this.removeRelayFile();
  }

  private onConnection(socket: WebSocket, request: IncomingMessage) {
    const token = new URL(request.url ?? "/", "http://127.0.0.1").searchParams.get("token");
    if (token !== this.token) {
      socket.close(1008, "invalid token");
      return;
    }
    if (this.socket && this.socket !== socket) this.socket.close(1000, "replaced");
    this.socket = socket;
    process.stderr.write("[tab-agent] 扩展 Native Host 已连接\n");

    socket.on("message", (raw) => {
      try {
        const message = JSON.parse(String(raw)) as {
          type?: string;
          id?: string;
          ok?: boolean;
          result?: unknown;
          error?: string;
        };
        if (message.type !== "tool_result" || !message.id) return;
        const pending = this.pending.get(message.id);
        if (!pending) return;
        this.pending.delete(message.id);
        clearTimeout(pending.timer);
        if (message.ok === false) {
          pending.reject(new Error(message.error || "工具调用失败"));
          return;
        }
        pending.resolve(message.result);
      } catch (error) {
        process.stderr.write(`[tab-agent] 无法解析扩展回包: ${String(error)}\n`);
      }
    });

    socket.on("close", () => {
      if (this.socket === socket) {
        this.socket = null;
        process.stderr.write("[tab-agent] 扩展 Native Host 已断开\n");
      }
    });
  }

  private writeRelayFile() {
    const payload: RelayPortFile = {
      protocolVersion: PROTOCOL_VERSION,
      pid: process.pid,
      port: this.port,
      url: `ws://127.0.0.1:${this.port}${RELAY_PATH}`,
      token: this.token,
      createdAt: Date.now(),
    };
    fs.writeFileSync(relayPortPath(), JSON.stringify(payload, null, 2), { mode: 0o600 });
  }

  private removeRelayFile() {
    const current = readRelayPort();
    if (current && current.pid !== process.pid) return;
    try {
      fs.unlinkSync(relayPortPath());
    } catch {
      /* ignore */
    }
  }
}
