import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { PROTOCOL_VERSION, TOOL_DEFINITIONS } from "@tab-title-agent/shared";
import { ExtensionRelay } from "./relay";

function mcpTools() {
  return TOOL_DEFINITIONS.map((tool) => {
    const params = tool.function.parameters as {
      type?: string;
      properties?: Record<string, unknown>;
      required?: string[];
    };
    return {
      name: tool.function.name,
      description: tool.function.description,
      inputSchema: {
        type: "object" as const,
        properties: params.properties ?? {},
        ...(params.required ? { required: params.required } : {}),
      },
    };
  });
}

function asText(value: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof value === "string" ? value : JSON.stringify(value, null, 2),
      },
    ],
  };
}

export async function runMcp() {
  const relay = new ExtensionRelay();
  await relay.start();

  const server = new Server(
    { name: "tab-agent", version: "0.1.0" },
    { capabilities: { tools: {}, resources: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: mcpTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const result = await relay.callTool(
        request.params.name,
        (request.params.arguments as Record<string, unknown> | undefined) ?? {},
      );
      return asText(result);
    } catch (error) {
      return {
        ...asText(error instanceof Error ? error.message : String(error)),
        isError: true,
      };
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: "tabs://current",
        name: "当前窗口标签",
        mimeType: "application/json",
        description: "当前窗口的 Tab 快照，含角色、需求组和是否手动锁定。",
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    if (request.params.uri !== "tabs://current") {
      throw new Error(`未知资源 ${request.params.uri}`);
    }
    const result = await relay.callTool("list_tabs", {});
    return {
      contents: [
        {
          uri: request.params.uri,
          mimeType: "application/json",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  const shutdown = async () => {
    await relay.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());
  process.stderr.write(
    `[tab-agent] MCP stdio 已启动（protocol v${PROTOCOL_VERSION}）。等待 Chrome 扩展连接。\n`,
  );

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
