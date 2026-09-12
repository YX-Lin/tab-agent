export default defineContentScript({
  matches: ["<all_urls>"],
  runAt: "document_idle",
  main() {
    let forced: string | null = null;
    let applying = false;

    const apply = (title: string) => {
      forced = title;
      applying = true;
      if (document.title !== title) document.title = title;
      queueMicrotask(() => {
        applying = false;
      });
    };

    const observer = new MutationObserver(() => {
      if (applying || !forced) return;
      if (document.title !== forced) apply(forced);
    });

    const titleEl = document.querySelector("title");
    if (titleEl) {
      observer.observe(titleEl, { childList: true, characterData: true, subtree: true });
    } else {
      observer.observe(document.documentElement, { subtree: true, childList: true });
    }

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message?.type === "APPLY_TITLE" && typeof message.title === "string") {
        apply(message.title);
        sendResponse({ ok: true });
      }
      if (message?.type === "CLEAR_TITLE") {
        forced = null;
        sendResponse({ ok: true });
      }
      return true;
    });

    void chrome.runtime.sendMessage({
      type: "CONTENT_READY",
      title: document.title,
    });
  },
});
