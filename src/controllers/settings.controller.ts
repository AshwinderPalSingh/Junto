import "server-only";
import { getVapidPublicKey } from "@/lib/push";
import { BlockModel } from "@/models/block.model";
import { PushSubscriptionModel } from "@/models/push-subscription.model";
import { displayName } from "@/models/user.model";
import type { SettingsVM } from "@/views/view-models";
import { requireMember } from "./guards";
import { presentPhoto } from "./presenters";

/** GET /settings */
export const SettingsController = {
  async show(): Promise<SettingsVM> {
    const user = await requireMember();
    const [blocked, pushDevices] = await Promise.all([
      BlockModel.listBlockedBy(user.id),
      PushSubscriptionModel.countForUser(user.id),
    ]);
    return {
      email: user.email,
      gender: user.gender ?? "",
      companionGenders: user.companionGenders,
      groupPref: user.groupPref,
      chatPolicy: user.chatPolicy,
      hasPassword: Boolean(user.passwordHash),
      vapidPublicKey: getVapidPublicKey(),
      pushDevices,
      blocked: blocked.map(({ user: b }) => ({ id: b.id, name: displayName(b), photo: presentPhoto(b) })),
      isAdmin: user.role === "admin",
    };
  },
};
