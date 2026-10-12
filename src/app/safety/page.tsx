import type { Metadata } from "next";
import { SafetyView } from "@/views/screens/public/safety-view";
import { accountHome, currentUser } from "@/controllers/guards";

export const metadata: Metadata = { title: "Safety centre" };

/** Safety stays public while preserving the signed-in member's return destination. */
export default async function SafetyPage() {
  const user = await currentUser();
  return <SafetyView returnHref={user ? accountHome(user) : "/"} />;
}
