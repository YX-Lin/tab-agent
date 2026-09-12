import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  PRODUCT_DIR_NAME,
  RELAY_FILENAME,
  type RelayPortFile,
} from "@tab-title-agent/shared";

export function dataDir() {
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local"),
      PRODUCT_DIR_NAME,
    );
  }
  if (process.platform === "darwin") {
    return path.join(os.homedir(), "Library", "Application Support", PRODUCT_DIR_NAME);
  }
  return path.join(
    process.env.XDG_DATA_HOME || path.join(os.homedir(), ".local", "share"),
    PRODUCT_DIR_NAME,
  );
}

export function relayPortPath() {
  return path.join(dataDir(), RELAY_FILENAME);
}

export function nativeHostJsPath() {
  return path.join(dataDir(), "native-host.mjs");
}

export function nativeHostLauncherPath() {
  return path.join(
    dataDir(),
    process.platform === "win32" ? "native-host.cmd" : "native-host.sh",
  );
}

export function nativeManifestPath() {
  return path.join(dataDir(), "com.tabagent.host.json");
}

export function installStatePath() {
  return path.join(dataDir(), "install-state.json");
}

export function packagedNativeHostPath() {
  return path.join(path.dirname(fileURLToPath(import.meta.url)), "native-host.js");
}

export function readRelayPort(): RelayPortFile | null {
  try {
    const raw = fs.readFileSync(relayPortPath(), "utf8");
    const parsed = JSON.parse(raw) as RelayPortFile;
    if (!parsed?.url || !parsed?.token || !parsed?.pid) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function isPidAlive(pid: number) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export function ensureDataDir() {
  fs.mkdirSync(dataDir(), { recursive: true });
}
