import { SystemController } from "@/controllers/system.controller";

/** Router: GET /api/health → SystemController.health */
export async function GET() {
  return SystemController.health();
}
