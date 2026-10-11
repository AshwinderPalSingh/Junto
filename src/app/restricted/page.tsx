import type { Metadata } from "next";
import { Suspense } from "react";
import { signOut } from "@/controllers/auth.actions";
import { RestrictionController } from "@/controllers/restriction.controller";
import { RestrictionView } from "@/views/screens/public/restriction-view";

export const metadata: Metadata = { title: "A short pause" };

async function Content() {
  return <RestrictionView vm={await RestrictionController.show()} signOut={signOut} />;
}

export default function RestrictedPage() {
  return <Suspense fallback={<div className="mx-auto min-h-dvh max-w-md p-8" />}><Content /></Suspense>;
}
