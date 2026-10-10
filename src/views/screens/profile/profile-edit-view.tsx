"use client";

import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ActionState } from "@/lib/action";
import { PageHeader, SectionTitle } from "@/views/components/bits";
import { AboutForm, PhotoUploader } from "@/views/screens/onboarding/profile-forms";
import type { OnboardingVM } from "@/views/view-models";

type Props = {
  vm: Pick<OnboardingVM, "profile" | "photo">;
  saveAbout: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  uploadPhoto: (prev: ActionState<{ url: string }>, formData: FormData) => Promise<ActionState<{ url: string }>>;
};

export function ProfileEditView({ vm, saveAbout, uploadPhoto }: Props) {
  return (
    <div className="space-y-10">
      <div>
        <Link
          href="/profile"
          className="group mb-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4 transition-transform group-hover:-translate-x-0.5" /> Profile
        </Link>
        <PageHeader eyebrow="Profile" title="Edit profile" description="Your photo, name and interests." />
      </div>
      <section>
        <SectionTitle>Photo</SectionTitle>
        <PhotoUploader photo={vm.photo} action={uploadPhoto} />
      </section>
      <section>
        <SectionTitle>About you</SectionTitle>
        <div className="glass p-5 sm:p-6">
          <AboutForm profile={vm.profile} action={saveAbout} submitLabel="Save changes" returnTo="profile" />
        </div>
      </section>
    </div>
  );
}
