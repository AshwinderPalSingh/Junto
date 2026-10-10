import type { Metadata } from "next";
import { Suspense } from "react";
import { startChat } from "@/controllers/chat.actions";
import { ProfileController } from "@/controllers/profile.controller";
import { blockMember, reportMember } from "@/controllers/safety.actions";
import { PageSkeleton } from "@/views/components/skeletons";
import { ProfileView } from "@/views/screens/profile/profile-view";

export const metadata: Metadata = { title: "Member" };

/** Router: GET /u/:id → ProfileController.show → ProfileView */
export default function MemberPage({ params }: PageProps<"/u/[id]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MemberContent params={params} />
    </Suspense>
  );
}

async function MemberContent({ params }: Pick<PageProps<"/u/[id]">, "params">) {
  const vm = await ProfileController.show(params);
  return <ProfileView vm={vm} actions={{ reportMember, blockMember, startChat }} />;
}
