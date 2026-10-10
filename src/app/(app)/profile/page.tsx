import type { Metadata } from "next";
import { Suspense } from "react";
import { ProfileController } from "@/controllers/profile.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { ProfileView } from "@/views/screens/profile/profile-view";

export const metadata: Metadata = { title: "Your profile" };

/** Router: GET /profile → ProfileController.me → ProfileView */
export default function ProfilePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileContent />
    </Suspense>
  );
}

async function ProfileContent() {
  return <ProfileView vm={await ProfileController.me()} />;
}
