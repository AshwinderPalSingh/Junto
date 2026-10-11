import type { Metadata } from "next";
import { Suspense } from "react";
import { AuthController } from "@/controllers/auth.controller";
import { resendCode, verifyCode } from "@/controllers/auth.actions";
import { AuthFrame } from "@/views/screens/auth/auth-frame";
import { FormSkeleton } from "@/views/screens/auth/form-skeleton";
import { VerifyView } from "@/views/screens/auth/verify-view";

export const metadata: Metadata = { title: "Enter your code" };

/** Router: GET /login/verify?email= → AuthController.verify → VerifyView */
export default function VerifyPage({ searchParams }: PageProps<"/login/verify">) {
  return (
    <AuthFrame>
      <Suspense fallback={<FormSkeleton />}>
        <VerifyContent searchParams={searchParams} />
      </Suspense>
    </AuthFrame>
  );
}

async function VerifyContent({ searchParams }: Pick<PageProps<"/login/verify">, "searchParams">) {
  const data = await AuthController.verify(searchParams);
  return (
    <VerifyView
      email={data.email}
      intent={data.intent}
      codeLength={data.codeLength}
      resendAfterSeconds={data.resendAfterSeconds}
      ttlMinutes={data.ttlMinutes}
      verifyCode={verifyCode}
      resendCode={resendCode}
    />
  );
}
