export const COMMAND_ACTION_EVENT = "hg:command-action";
export const COMMAND_ACTION_STORAGE_KEY = "hg:pending-command-action";

export type CommandActionKey =
  | "open-product-form"
  | "open-excel-import"
  | "seed-demo-data";

export type CommandActionEventDetail = {
  action: CommandActionKey;
};

const COMMAND_ACTION_KEYS: CommandActionKey[] = [
  "open-product-form",
  "open-excel-import",
  "seed-demo-data",
];

function isCommandActionKey(value: string): value is CommandActionKey {
  return COMMAND_ACTION_KEYS.includes(value as CommandActionKey);
}

export function queueCommandAction(action: CommandActionKey) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(COMMAND_ACTION_STORAGE_KEY, action);
}

export function popQueuedCommandAction(): CommandActionKey | null {
  if (typeof window === "undefined") return null;

  const value = window.sessionStorage.getItem(COMMAND_ACTION_STORAGE_KEY);
  if (!value) {
    return null;
  }

  window.sessionStorage.removeItem(COMMAND_ACTION_STORAGE_KEY);
  return isCommandActionKey(value) ? value : null;
}

export function dispatchCommandAction(action: CommandActionKey) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<CommandActionEventDetail>(COMMAND_ACTION_EVENT, {
      detail: { action },
    })
  );
}
