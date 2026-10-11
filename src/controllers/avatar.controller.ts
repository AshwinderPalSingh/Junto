import "server-only";
import { BlockModel } from "@/models/block.model";
import { hasPhoto, UserModel } from "@/models/user.model";
import { currentUser } from "./guards";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * GET /api/avatars/:userId — profile photos are visible to every signed-in
 * member (never publicly on the internet). Blocks hide them both ways.
 */
export const AvatarController = {
  async show(userId: string): Promise<Response> {
    const viewer = await currentUser();
    if (!viewer || viewer.status !== "active") return new Response("Unauthorized", { status: 401 });
    if (viewer.ratingRestrictedUntil && viewer.ratingRestrictedUntil > new Date()) return new Response("Account paused", { status: 403 });
    if (!UUID.test(userId)) return new Response("Not found", { status: 404 });
    const target = await UserModel.findById(userId);
    if (!target || !hasPhoto(target) || target.status === "deleted") return new Response("Not found", { status: 404 });

    const own = viewer.id === target.id;
    if (!own && viewer.role !== "admin" && (await BlockModel.isBlockedEitherWay(viewer.id, target.id))) {
      return new Response("Not found", { status: 404 });
    }

    const photo = await UserModel.getPhoto(target.id);
    if (!photo) return new Response("Not found", { status: 404 });
    return new Response(new Uint8Array(photo.data), {
      headers: {
        "Content-Type": photo.contentType,
        // The URL carries the photo's version, so a new upload is fetched immediately.
        "Cache-Control": "private, max-age=86400",
        "Content-Security-Policy": "default-src 'none'",
        "X-Content-Type-Options": "nosniff",
      },
    });
  },
};
