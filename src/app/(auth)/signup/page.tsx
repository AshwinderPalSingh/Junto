import type { Metadata } from "next";
import { Suspense } from "react";
import { startPasswordFlow } from "@/controllers/auth.actions";
import { AuthController } from "@/controllers/auth.controller";
import { AuthFrame } from "@/views/screens/auth/auth-frame";
import { FormSkeleton } from "@/views/screens/auth/form-skeleton";
import { PasswordFlowView } from "@/views/screens/auth/password-flow-view";

export const metadata: Metadata = { title: "Create your account" };

/** Router: GET /signup → AuthController.login → PasswordFlowView (POST → startPasswordFlow("signup")) */
export default function SignupPage() {
  return (
    <AuthFrame>
      <Suspense fallback={<FormSkeleton />}>
        <SignupContent />
      </Suspense>
    </AuthFrame>
  );
}

async function SignupContent() {
  const data = await AuthController.login();
  return <PasswordFlowView intent="signup" domain={data.domain} action={startPasswordFlow.bind(null, "signup")} />;
}
