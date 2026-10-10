import type { Metadata } from "next";
import { SafetyView } from "@/views/screens/public/safety-view";

export const metadata: Metadata = { title: "Safety centre" };

/** Router: GET /safety — public, static. */
export default function SafetyPage() {
  return <SafetyView />;
}
