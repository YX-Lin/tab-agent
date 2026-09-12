export const NATIVE_HOST_NAME = "com.tabagent.host";
export const PRODUCT_DIR_NAME = "tab-agent";
export const RELAY_FILENAME = "relay-port.json";
export const RELAY_PATH = "/extension";

/** Unpacked / local builds pin this ID via the public key in the extension manifest. */
export const PINNED_EXTENSION_ID = "mpnijlahdfoojpeafkikfcnofgebeilh";
export const PINNED_EXTENSION_KEY =
  "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA3LfhQyc07TPuWrGKX0xm8kd6Vt/tT3RcBy6QJaJJTv/jGdsAwA6IP9rSk9mewyac+EdpRxvYHVsIMz04fJPLhAX97jXx0kTsg167T1oQBm4vJk1fCGzVWxn9Hb1c6/y/pY5+pDA5m1oJKz7H9G2ym/fNVIZRzHWWWdetHb1h4t1WM4l/6vzHo0IiuobQ9UET+1tAMSBSjcuMGER9gUL9qDAjZM/6kpIR26Vx0MQ6MLVs/B/tXFIw/LVcsquwnh9TIBdxGfkQuejAbzaIqCo3OPr0BdqQRZiDbTmSmCWbzaKsGfgidQd/OL9+46SQRgm++6sq8FG3W8fBNLYsvLORfQIDAQAB";

export type RelayPortFile = {
  protocolVersion: number;
  pid: number;
  port: number;
  url: string;
  token: string;
  createdAt: number;
};

export type NativeToExtension =
  | { type: "hello_ok"; protocolVersion: number }
  | { type: "ping"; at: number }
  | { type: "relay"; url: string; protocolVersion: number }
  | { type: "relay_down" }
  | { type: "call_tool"; id: string; name: string; args: Record<string, unknown> };

export type ExtensionToNative =
  | { type: "hello"; protocolVersion: number; extensionId: string }
  | { type: "pong"; at?: number }
  | {
      type: "tool_result";
      id: string;
      ok: boolean;
      result?: unknown;
      error?: string;
    };

export type RelayHello = {
  type: "hello";
  protocolVersion: number;
  role: "native-host";
};

export type McpStatus = {
  mcpEnabled: boolean;
  nativeConnected: boolean;
  relaySeen: boolean;
  protocolVersion: number;
  extensionId: string;
  hostName: string;
  lastError?: string;
};
