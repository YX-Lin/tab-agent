export function encodeNativeMessage(message: unknown) {
  const body = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(body.length, 0);
  return Buffer.concat([header, body]);
}

export function createNativeMessaging() {
  let buffer = Buffer.alloc(0);
  const listeners = new Set<(message: unknown) => void>();

  const onData = (chunk: Buffer) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 4) {
      const length = buffer.readUInt32LE(0);
      if (buffer.length < 4 + length) break;
      const json = buffer.subarray(4, 4 + length).toString("utf8");
      buffer = buffer.subarray(4 + length);
      try {
        const parsed: unknown = JSON.parse(json);
        for (const listener of listeners) listener(parsed);
      } catch (error) {
        process.stderr.write(`[tab-agent host] invalid native message: ${String(error)}\n`);
      }
    }
  };

  process.stdin.on("data", onData);
  process.stdin.on("end", () => process.exit(0));
  process.stdin.on("error", () => process.exit(1));
  process.stdin.resume();

  return {
    onMessage(listener: (message: unknown) => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    send(message: unknown) {
      process.stdout.write(encodeNativeMessage(message));
    },
  };
}
