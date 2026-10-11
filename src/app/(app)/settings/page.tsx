import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/controllers/auth.actions";
import { savePreferences } from "@/controllers/onboarding.actions";
import { unblockMember } from "@/controllers/safety.actions";
import {
  deleteAccount,
  removePushSubscription,
  saveChatPolicy,
  savePassword,
  savePushSubscription,
  sendTestPush,
} from "@/controllers/settings.actions";
import { SettingsController } from "@/controllers/settings.controller";
import { PageSkeleton } from "@/views/components/skeletons";
import { SettingsView } from "@/views/screens/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

/** Router: GET /settings → SettingsController.show → SettingsView */
export default function SettingsPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SettingsContent />
    </Suspense>
  );
}

async function SettingsContent() {
  const vm = await SettingsController.show();
  return (
    <SettingsView
      vm={vm}
      actions={{
        savePreferences,
        savePassword,
        saveChatPolicy,
        savePushSubscription,
        removePushSubscription,
        sendTestPush,
        unblockMember,
        deleteAccount,
        signOut,
      }}
    />
  );
}
