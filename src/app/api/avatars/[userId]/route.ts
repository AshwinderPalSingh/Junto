import { AvatarController } from "@/controllers/avatar.controller";

/** Router: GET /api/avatars/:userId → AvatarController.show */
export async function GET(_request: Request, context: RouteContext<"/api/avatars/[userId]">) {
  const { userId } = await context.params;
  return AvatarController.show(userId);
}
