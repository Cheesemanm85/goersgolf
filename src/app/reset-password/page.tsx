import type { Metadata } from "next";
import { ResetPasswordClient } from "@/app/reset-password/resetPasswordClient";

export const metadata: Metadata = {
  title: "Reset password · Goers Golf",
};

export default function ResetPasswordPage() {
  return <ResetPasswordClient />;
}

