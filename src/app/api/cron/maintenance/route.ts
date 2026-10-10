import { SystemController } from "@/controllers/system.controller";

/** Router: GET|POST /api/cron/maintenance (Bearer CRON_SECRET) → SystemController.maintenance */
export async function GET(request: Request) {
  return SystemController.maintenance(request);
}

export async function POST(request: Request) {
  return SystemController.maintenance(request);
}
