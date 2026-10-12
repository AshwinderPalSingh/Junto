import { LandingView } from "@/views/screens/landing/landing-view";
import { redirect } from "next/navigation";
import { accountHome, currentUser } from "@/controllers/guards";

/** Visitors see the public page; members return to their account without signing in again. */
export default async function HomePage() {
  const user = await currentUser();
  if (user) redirect(accountHome(user));
  return <LandingView />;
}
