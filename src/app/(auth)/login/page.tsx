import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthController } from "@/controllers/auth.controller";
import { requestCode } from "@/controllers/auth.actions";
import { AuthFrame } from "@/views/screens/auth/auth-frame";
import { FormSkeleton } from "@/views/screens/auth/form-skeleton";
import { LoginView } from "@/views/screens/auth/login-view";

export const metadata: Metadata = { title: "Sign in" };

/** Router: GET /login → AuthController.login → LoginView */
export default function LoginPage() {
  return (
    <AuthFrame>
      <Suspense fallback={<FormSkeleton />}>
        <LoginContent />
      </Suspense>
    </AuthFrame>
  );
}

async function LoginContent() {
  const data = await AuthController.login();
  return <LoginView domain={data.domain} requestCode={requestCode} />;
}
