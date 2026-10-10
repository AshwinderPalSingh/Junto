import type { Metadata } from "next";
import { Suspense } from "react";
import { setMemberStatus } from "@/controllers/admin.actions";
import { AdminController } from "@/controllers/admin.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { MembersView } from "@/views/screens/admin/members-view";

export const metadata: Metadata = { title: "Members" };

/** Router: GET /admin/members?q= → AdminController.members → MembersView */
export default function MembersPage({ searchParams }: PageProps<"/admin/members">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <MembersContent searchParams={searchParams} />
    </Suspense>
  );
}

async function MembersContent({ searchParams }: Pick<PageProps<"/admin/members">, "searchParams">) {
  const { query, members, now } = await AdminController.members(searchParams);
  return <MembersView query={query} members={members} now={now} setMemberStatus={setMemberStatus} />;
}
