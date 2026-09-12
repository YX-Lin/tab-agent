import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  NATIVE_HOST_NAME,
  PINNED_EXTENSION_ID,
  PROTOCOL_VERSION,
} from "@tab-title-agent/shared";
import {
  dataDir,
  installStatePath,
  isPidAlive,
  nativeHostJsPath,
  nativeHostLauncherPath,
  nativeManifestPath,
  packagedNativeHostPath,
  readRelayPort,
} from "./paths";

export type InstallOptions = {
  extensionId?: string;
  browsers?: Array<"chrome" | "edge" | "chromium">;
};

type InstallState = {
  extensionId: string;
  hostName: string;
  protocolVersion: number;
  launcher: string;
  manifest: string;
  node: string;
  browsers: string[];
  installedAt: number;
};

function chromeOrigin(extensionId: string) {
  return `chrome-extension://${extensionId}/`;
}

function writeLauncher(nodePath: string, hostJs: string) {
  const launcher = nativeHostLauncherPath();
  if (process.platform === "win32") {
    const body = `@echo off\r\nsetlocal\r\n"${nodePath}" "${hostJs}" %*\r\n`;
    fs.writeFileSync(launcher, body, "utf8");
    return launcher;
  }
  const body = `#!/bin/sh\nexec "${nodePath}" "${hostJs}" "$@"\n`;
  fs.writeFileSync(launcher, body, { encoding: "utf8", mode: 0o755 });
  return launcher;
}

function writeManifest(extensionId: string, launcher: string) {
  const manifest = {
    name: NATIVE_HOST_NAME,
    description: "Tab Agent native messaging host",
    path: launcher,
    type: "stdio",
    allowed_origins: [chromeOrigin(extensionId)],
  };
  const file = nativeManifestPath();
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2), "utf8");
  return file;
}

function registryKey(browser: "chrome" | "edge" | "chromium") {
  if (browser === "edge") {
    return `HKCU\\Software\\Microsoft\\Edge\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
  }
  if (browser === "chromium") {
    return `HKCU\\Software\\Chromium\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
  }
  return `HKCU\\Software\\Google\\Chrome\\NativeMessagingHosts\\${NATIVE_HOST_NAME}`;
}

function unixManifestDir(browser: "chrome" | "edge" | "chromium") {
  const home = os.homedir();
  if (process.platform === "darwin") {
    if (browser === "edge") {
      return path.join(home, "Library", "Application Support", "Microsoft Edge", "NativeMessagingHosts");
    }
    if (browser === "chromium") {
      return path.join(home, "Library", "Application Support", "Chromium", "NativeMessagingHosts");
    }
    return path.join(home, "Library", "Application Support", "Google", "Chrome", "NativeMessagingHosts");
  }
  const config = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
  if (browser === "edge") return path.join(config, "microsoft-edge", "NativeMessagingHosts");
  if (browser === "chromium") return path.join(config, "chromium", "NativeMessagingHosts");
  return path.join(config, "google-chrome", "NativeMessagingHosts");
}

function register(browser: "chrome" | "edge" | "chromium", manifestFile: string) {
  if (process.platform === "win32") {
    execFileSync(
      "reg",
      ["add", registryKey(browser), "/ve", "/t", "REG_SZ", "/d", manifestFile, "/f"],
      { stdio: "ignore" },
    );
    return;
  }
  const dir = unixManifestDir(browser);
  fs.mkdirSync(dir, { recursive: true });
  fs.copyFileSync(manifestFile, path.join(dir, `${NATIVE_HOST_NAME}.json`));
}

function unregister(browser: "chrome" | "edge" | "chromium") {
  if (process.platform === "win32") {
    try {
      execFileSync("reg", ["delete", registryKey(browser), "/f"], { stdio: "ignore" });
    } catch {
      /* already gone */
    }
    return;
  }
  try {
    fs.unlinkSync(path.join(unixManifestDir(browser), `${NATIVE_HOST_NAME}.json`));
  } catch {
    /* already gone */
  }
}

function defaultBrowsers(): Array<"chrome" | "edge" | "chromium"> {
  return process.platform === "win32" ? ["chrome", "edge"] : ["chrome"];
}

export function installNativeHost(options: InstallOptions = {}) {
  const extensionId = (options.extensionId || PINNED_EXTENSION_ID).trim();
  const browsers = options.browsers?.length ? options.browsers : defaultBrowsers();
  const packaged = packagedNativeHostPath();
  if (!fs.existsSync(packaged)) {
    throw new Error(
      `找不到 Native Host 脚本：${packaged}。请先在仓库里执行 pnpm --filter tab-agent build。`,
    );
  }

  fs.mkdirSync(dataDir(), { recursive: true });
  fs.copyFileSync(packaged, nativeHostJsPath());
  const launcher = writeLauncher(process.execPath, nativeHostJsPath());
  const manifest = writeManifest(extensionId, launcher);
  for (const browser of browsers) register(browser, manifest);

  const state: InstallState = {
    extensionId,
    hostName: NATIVE_HOST_NAME,
    protocolVersion: PROTOCOL_VERSION,
    launcher,
    manifest,
    node: process.execPath,
    browsers,
    installedAt: Date.now(),
  };
  fs.writeFileSync(installStatePath(), JSON.stringify(state, null, 2), "utf8");
  return state;
}

export function uninstallNativeHost() {
  let browsers = defaultBrowsers();
  try {
    const state = JSON.parse(fs.readFileSync(installStatePath(), "utf8")) as InstallState;
    if (Array.isArray(state.browsers) && state.browsers.length) {
      browsers = state.browsers as Array<"chrome" | "edge" | "chromium">;
    }
  } catch {
    /* use defaults */
  }
  for (const browser of browsers) unregister(browser);
  for (const file of [
    nativeHostJsPath(),
    nativeHostLauncherPath(),
    nativeManifestPath(),
    installStatePath(),
  ]) {
    try {
      fs.unlinkSync(file);
    } catch {
      /* ignore */
    }
  }
}

export function statusReport() {
  let install: InstallState | null = null;
  try {
    install = JSON.parse(fs.readFileSync(installStatePath(), "utf8")) as InstallState;
  } catch {
    install = null;
  }
  const relay = readRelayPort();
  return {
    dataDir: dataDir(),
    installed: Boolean(install),
    install,
    hostPresent: fs.existsSync(nativeHostJsPath()),
    launcherPresent: fs.existsSync(nativeHostLauncherPath()),
    relay: relay
      ? {
          ...relay,
          alive: isPidAlive(relay.pid),
        }
      : null,
  };
}
