import "server-only";
import { subscribe, type LiveEvent } from "@/lib/realtime";
import { currentUser } from "./guards";

/**
 * Streams end on their own before the host would cut them off (Vercel functions
 * stop after 300 seconds), and the browser reconnects straight away. Long-running
 * servers keep them open longer.
 */
const STREAM_LIFETIME_MS = process.env.VERCEL ? 240_000 : 30 * 60_000;

/**
 * GET /api/events — a Server-Sent Events stream of this member's live
 * updates (new requests, acceptances, meetup messages…).
 */
export const EventsController = {
  async stream(request: Request): Promise<Response> {
    const user = await currentUser();
    if (!user) return new Response("Unauthorized", { status: 401 });
    if (user.status !== "active" || (user.ratingRestrictedUntil && user.ratingRestrictedUntil > new Date())) {
      return new Response("Account paused", { status: 403 });
    }

    const encoder = new TextEncoder();
    let cleanup = () => {};

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const write = (chunk: string) => {
          try {
            controller.enqueue(encoder.encode(chunk));
          } catch {
            cleanup();
          }
        };
        const send = (event: LiveEvent) => write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);

        write("retry: 5000\n\n");
        write(`event: ready\ndata: {}\n\n`);
        const unsubscribe = subscribe(user.id, send);
        // A comment line keeps proxies from closing an idle stream. It touches no database.
        const heartbeat = setInterval(() => write(": ping\n\n"), 25_000);
        const lifetime = setTimeout(() => {
          write(`event: bye\ndata: {}\n\n`);
          cleanup();
        }, STREAM_LIFETIME_MS);

        cleanup = () => {
          clearInterval(heartbeat);
          clearTimeout(lifetime);
          unsubscribe();
          cleanup = () => {};
          try {
            controller.close();
          } catch {
            // already closed
          }
        };
        request.signal.addEventListener("abort", () => cleanup());
      },
      cancel() {
        cleanup();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "private, no-store, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
};
