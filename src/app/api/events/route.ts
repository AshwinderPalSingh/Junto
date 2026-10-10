import { EventsController } from "@/controllers/events.controller";

/** Router: GET /api/events → EventsController.stream (Server-Sent Events) */
export async function GET(request: Request) {
  return EventsController.stream(request);
}
