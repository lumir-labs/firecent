import { getServerSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import React from "react";

type Props = { children: React.ReactNode };

export default async function ProtectedLayout({ children }: Props) {
  const session = await getServerSession();

  //REDUNDANT WITH PROXY.TS, BUT SERVES THE ROUTED APP
  if (!session) {
    redirect("/auth/login");
  }

  if (!session.user.isOnboarded) {
    redirect("/onboarding");
  }

  return <div>{children}</div>;
}
