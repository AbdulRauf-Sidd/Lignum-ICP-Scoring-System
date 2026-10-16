import { Suspense } from "react";
import { PasswordRecoveryRequest } from "@/components/auth/password-recovery-request";

export default function PasswordRecoveryPage() {
  return (
    <Suspense>
      <PasswordRecoveryRequest />
    </Suspense>
  );
}
