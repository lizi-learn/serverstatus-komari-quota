import type { Record as LiveRecord } from "@/types/LiveData";

export const RELAY_ACTIVE_RATE = 128 * 1024;
export const RELAY_FAST_RATE = 1024 * 1024;

export type RelayTrafficState = "idle" | "active" | "fast" | "offline";

export function relayTrafficState(
  record: LiveRecord | undefined,
  online: boolean,
): RelayTrafficState {
  if (!online) return "offline";
  const rate = (record?.network.down ?? 0) + (record?.network.up ?? 0);
  if (rate >= RELAY_FAST_RATE) return "fast";
  if (rate >= RELAY_ACTIVE_RATE) return "active";
  return "idle";
}
