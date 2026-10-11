import "server-only";
import { redirect } from "next/navigation";
import { ReputationModel } from "@/models/reputation.model";
import { requireAccount } from "./guards";

export const RestrictionController = {
  async show() {
    const user = await requireAccount();
    if (!user.ratingRestrictedUntil || user.ratingRestrictedUntil <= new Date()) redirect("/board");
    const rep = await ReputationModel.forUser(user.id);
    return { now: new Date().toISOString(), until: user.ratingRestrictedUntil.toISOString(), rating: rep.rating, noShows: rep.noShows, lateCancels: rep.lateCancels };
  },
};
