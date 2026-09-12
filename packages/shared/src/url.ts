export function parseUrl(raw?: string | null): URL | null {
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function urlKey(raw?: string | null): string {
  const url = parseUrl(raw);
  if (!url) return raw ?? "";
  return `${url.origin}${url.pathname}`;
}

export function hostOf(raw?: string | null): string {
  return parseUrl(raw)?.hostname.replace(/^www\./, "") ?? "";
}

export function originOf(raw?: string | null): string {
  return parseUrl(raw)?.origin ?? "";
}

export function isRestrictedUrl(raw?: string | null): boolean {
  if (!raw) return true;
  return /^(chrome|edge|about|devtools|chrome-extension|moz-extension):/i.test(
    raw,
  ) || raw.startsWith("https://chrome.google.com/webstore")
    || raw.startsWith("https://chromewebstore.google.com");
}

export function globToRegExp(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`, "i");
}

export function urlMatchesGlob(glob: string, raw: string): boolean {
  return globToRegExp(glob).test(raw);
}
