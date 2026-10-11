import "server-only";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { acceptedMembers, PlanModel } from "@/models/plan.model";
import { ShareLinkModel } from "@/models/share-link.model";
import { firstNameOf } from "@/models/user.model";
import type { PlanStatusVM, ShareVM } from "@/views/view-models";
import { presentActivity, presentSpot } from "./presenters";

/**
 * GET /s/:token — public, read-only meetup details for a trusted contact.
 * Shows first names, the activity, the public spot and the time. Nothing else.
 */
export const ShareController = {
  async show(params: Promise<{ token: string }>): Promise<ShareVM> {
    await connection();
    const { token } = await params;
    if (!/^[A-Za-z0-9_-]{10,64}$/.test(token)) notFound();
    const now = new Date();
    const link = await ShareLinkModel.find(token, now);
    if (!link) notFound();
    const bundle = await PlanModel.bundle(link.planId);
    if (!bundle) notFound();
    const sharer = acceptedMembers(bundle).find((m) => m.user.id === link.userId)?.user ?? bundle.members.find((m) => m.user.id === link.userId)?.user;
    if (!sharer) notFound();
    return {
      now: now.toISOString(),
      sharer: firstNameOf(sharer),
      activity: presentActivity(bundle.plan.activity),
      spot: presentSpot(bundle.plan.spot),
      startsAt: bundle.plan.startsAt.toISOString(),
      endsAt: bundle.plan.endsAt.toISOString(),
      people: acceptedMembers(bundle)
        .filter((m) => m.user.id !== sharer.id)
        .map((m) => firstNameOf(m.user)),
      status: bundle.plan.status as PlanStatusVM,
    };
  },
};
