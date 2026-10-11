import type { Metadata } from "next";
import { Suspense } from "react";
import { startPasswordFlow } from "@/controllers/auth.actions";
import { AuthController } from "@/controllers/auth.controller";
import { AuthFrame } from "@/views/screens/auth/auth-frame";
import { FormSkeleton } from "@/views/screens/auth/form-skeleton";
import { PasswordFlowView } from "@/views/screens/auth/password-flow-view";

export const metadata: Metadata = { title: "Reset your password" };

/** Router: GET /login/reset → AuthController.login → PasswordFlowView (POST → startPasswordFlow("reset")) */
export default function ResetPasswordPage() {
  return (
    <AuthFrame>
      <Suspense fallback={<FormSkeleton />}>
        <ResetContent />
      </Suspense>
    </AuthFrame>
  );
}

async function ResetContent() {
  const data = await AuthController.login();
  return <PasswordFlowView intent="reset" domain={data.domain} action={startPasswordFlow.bind(null, "reset")} />;
}
