import "server-only";
import { subscribe, type LiveEvent } from "@/lib/realtime";
import { maybeRunMaintenance } from "@/models/maintenance";
import { currentUser } from "./guards";

/**
 * GET /api/events — a Server-Sent Events stream of this member's live
 * updates (new requests, acceptances, meetup messages…).
 */
export const EventsController = {
  async stream(request: Request): Promise<Response> {
    const user = await currentUser();
    if (!user) return new Response("Unauthorized", { status: 401 });

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
        const heartbeat = setInterval(() => {
          write(": ping\n\n");
          void maybeRunMaintenance();
        }, 25_000);

        cleanup = () => {
          clearInterval(heartbeat);
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
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  },
};
