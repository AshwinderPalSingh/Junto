import "server-only";
import { EventEmitter } from "node:events";
import type { ChatMessageVM } from "@/views/view-models";

/**
 * Live events for the Server-Sent Events stream (/api/events).
 *
 * Every server instance keeps a local emitter for the browsers connected to
 * it. When a database transport is registered (Postgres LISTEN/NOTIFY, wired
 * up by the database client), events travel through Postgres so members
 * connected to other instances receive them too.
 */
export type LiveEvent =
  | {
      type: "notification";
      id: string;
      kind: string;
      title: string;
      body: string;
      href: string | null;
      planId: string | null;
    }
  | { type: "plan"; planId: string; reason: "message" | "update" }
  | {
      type: "chat";
      conversationId: string;
      /** Set for a plan's group chat. */
      planId: string | null;
      senderName: string;
      preview: string;
      /** The message as this recipient sees it; null when too large to inline (fetched instead). */
      message: ChatMessageVM | null;
    };

export type RealtimeTransport = {
  notify: (payload: string) => Promise<unknown>;
};

type Bus = { emitter: EventEmitter; transport: RealtimeTransport | null };

const globalForBus = globalThis as unknown as { __juntoBus?: Bus };

const bus: Bus =
  globalForBus.__juntoBus ??
  (() => {
    const emitter = new EventEmitter();
    emitter.setMaxListeners(0);
    const created: Bus = { emitter, transport: null };
    globalForBus.__juntoBus = created;
    return created;
  })();

/** Called by the database client once LISTEN is active. */
export function registerTransport(transport: RealtimeTransport) {
  bus.transport = transport;
}

/** Delivers a payload received from the transport to local subscribers. */
export function deliverFromTransport(payload: string) {
  try {
    const { userId, event } = JSON.parse(payload) as { userId: string; event: LiveEvent };
    bus.emitter.emit(`user:${userId}`, event);
  } catch (error) {
    console.warn("[realtime] bad payload", error);
  }
}

/** Postgres NOTIFY payloads must stay under 8000 bytes. */
const MAX_NOTIFY_BYTES = 7_500;

export async function publish(userId: string, event: LiveEvent): Promise<void> {
  if (bus.transport) {
    const payload = JSON.stringify({ userId, event });
    if (Buffer.byteLength(payload) > MAX_NOTIFY_BYTES && event.type === "chat" && event.message) {
      // Too big to travel through Postgres: send the nudge only; the browser fetches the message.
      return publish(userId, { ...event, message: null });
    }
    try {
      await bus.transport.notify(payload);
      return;
    } catch (error) {
      console.warn("[realtime] notify failed, delivering locally", error);
    }
  }
  try {
    bus.emitter.emit(`user:${userId}`, event);
  } catch (error) {
    console.warn("[realtime] local delivery failed", error);
  }
}

export function subscribe(userId: string, listener: (event: LiveEvent) => void) {
  const channel = `user:${userId}`;
  bus.emitter.on(channel, listener);
  return () => {
    bus.emitter.off(channel, listener);
  };
}

/** Browsers connected to this instance for a member. */
export const localListenerCount = (userId: string) => bus.emitter.listenerCount(`user:${userId}`);
