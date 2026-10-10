import type { Metadata } from "next";
import { Suspense } from "react";
import { saveAbout, uploadPhoto } from "@/controllers/onboarding.actions";
import { ProfileController } from "@/controllers/profile.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { ProfileEditView } from "@/views/screens/profile/profile-edit-view";

export const metadata: Metadata = { title: "Edit profile" };

/** Router: GET /profile/edit → ProfileController.edit → ProfileEditView */
export default function ProfileEditPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ProfileEditContent />
    </Suspense>
  );
}

async function ProfileEditContent() {
  return <ProfileEditView vm={await ProfileController.edit()} saveAbout={saveAbout} uploadPhoto={uploadPhoto} />;
}
