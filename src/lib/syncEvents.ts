/**
 * syncEvents.ts — Cross-tab & real-time UI synchronization event bus
 *
 * Uses the native Web BroadcastChannel API to notify other browser tabs
 * (e.g. Dashboard, Booking list, Roster) instantly when an action occurs.
 */

export type SyncEventType = "BOOKINGS_CHANGED" | "ROOM_BLOCKS_CHANGED";

const CHANNEL_NAME = "everyinn_sync_channel";

export function notifyDataChanged(type: SyncEventType = "BOOKINGS_CHANGED"): void {
  if (typeof window === "undefined") return;

  try {
    if ("BroadcastChannel" in window) {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type, timestamp: Date.now() });
      channel.close();
    }
  } catch (err) {
    console.warn("Failed to broadcast sync event:", err);
  }
}

export function subscribeToSyncEvents(
  callback: (type: SyncEventType) => void
): () => void {
  if (typeof window === "undefined" || !("BroadcastChannel" in window)) {
    return () => {};
  }

  try {
    const channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type) {
        callback(event.data.type);
      }
    };

    return () => {
      channel.close();
    };
  } catch {
    return () => {};
  }
}
