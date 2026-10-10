import type { Metadata } from "next";
import { Suspense } from "react";
import {
  cancelPlan,
  checkIn,
  createShareLink,
  decideRequest,
  leavePlan,
  requestToJoin,
  submitFeedback,
  withdrawRequest,
} from "@/controllers/plan.actions";
import { loadEarlierMessages, loadNewMessages, markChatRead, sendChatMessage, startChat } from "@/controllers/chat.actions";
import { PlanController } from "@/controllers/plan.controller";
import { blockMember, reportMember } from "@/controllers/safety.actions";
import { PageSkeleton } from "@/views/components/skeletons";
import { PlanDetailView } from "@/views/screens/plans/plan-detail-view";

export const metadata: Metadata = { title: "Plan" };

/** Router: GET /plans/:id → PlanController.show → PlanDetailView (actions bound to this plan) */
export default function PlanPage({ params, searchParams }: PageProps<"/plans/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PlanContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function PlanContent({ params, searchParams }: PageProps<"/plans/[id]">) {
  const [vm, query] = await Promise.all([PlanController.show(params), searchParams]);
  const id = vm.plan.id;
  const chatId = vm.chat?.conversationId;
  return (
    <PlanDetailView
      vm={vm}
      justPosted={query.posted === "1"}
      actions={{
        requestToJoin: requestToJoin.bind(null, id),
        withdrawRequest: withdrawRequest.bind(null, id),
        decideRequest: decideRequest.bind(null, id),
        leavePlan: leavePlan.bind(null, id),
        cancelPlan: cancelPlan.bind(null, id),
        checkIn: checkIn.bind(null, id),
        submitFeedback: submitFeedback.bind(null, id),
        createShareLink: createShareLink.bind(null, id),
        reportMember,
        blockMember,
        startChat,
        chat: chatId
          ? {
              send: sendChatMessage.bind(null, chatId),
              markRead: markChatRead.bind(null, chatId),
              loadEarlier: loadEarlierMessages.bind(null, chatId),
              loadNew: loadNewMessages.bind(null, chatId),
            }
          : null,
      }}
    />
  );
}
