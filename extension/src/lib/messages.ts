export type ClientRequest =
  | { type: "GET_SNAPSHOT"; windowId?: number }
  | { type: "SET_TITLE"; tabId: number; title: string; role?: string; recordHabit?: boolean }
  | { type: "RESTORE_TITLE"; tabId: number }
  | { type: "CREATE_GROUP"; title: string; tabIds: number[] }
  | { type: "RENAME_GROUP"; groupId: number; title: string; color?: string }
  | { type: "SET_ACTIVE"; windowId: number; groupId: number | null }
  | { type: "MOVE_TO_GROUP"; tabIds: number[]; groupId: number; recordHabit?: boolean }
  | { type: "UNGROUP"; tabIds: number[] }
  | { type: "BIND_ORIGIN"; origin: string; groupId: number; role?: string }
  | { type: "UPSERT_RULE"; rule: unknown }
  | { type: "DELETE_RULE"; id: string }
  | { type: "TOGGLE_RULE"; id: string; enabled: boolean }
  | { type: "APPLY_RULES"; tabIds?: number[] }
  | { type: "COMPILE_RULE"; utterance: string }
  | { type: "PREVIEW_RULE"; utterance?: string; ruleId?: string }
  | { type: "PROMOTE_HABITS" }
  | { type: "UNDO_LEARNED" }
  | { type: "GET_SETTINGS" }
  | { type: "GET_RULES" }
  | { type: "SET_SETTINGS"; settings: Record<string, unknown> }
  | { type: "ACTIVATE_TAB"; tabId: number }
  | { type: "CALL_TOOL"; name: string; args: Record<string, unknown> }
  | { type: "GET_MCP_STATUS" }
  | { type: "CONTENT_READY"; title: string }
  | { type: "OPEN_RENAME"; tabId: number };

export async function send<T = unknown>(message: ClientRequest): Promise<T> {
  return chrome.runtime.sendMessage(message) as Promise<T>;
}
