/*
Sync state (UI indicators)
- بسيط وخفيف: نستخدم useSyncExternalStore لربط React بأي تحديثات.
*/

import * as React from "react";

export type SyncStatus = "offline" | "idle" | "syncing" | "synced" | "live" | "error";

type SyncSnapshot = {
  status: SyncStatus;
  label?: string;
  live?: boolean;
};

let snapshot: SyncSnapshot = { status: "offline", label: "Local", live: false };
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function setSyncSnapshot(next: SyncSnapshot) {
  snapshot = next;
  emit();
}

export function getSyncSnapshot() {
  return snapshot;
}

export function subscribeSync(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useSyncSnapshot() {
  return React.useSyncExternalStore(subscribeSync, getSyncSnapshot, getSyncSnapshot);
}
