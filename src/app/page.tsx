import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import type { Metadata } from "next";
import { getHomeRedirectPath } from "@/services/onboarding.service";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Gabi Rego Studio",
  description: "Área de acesso do Gabi Rego Studio.",
};

export default async function HomePage() {
  const session = await auth();

  if (!session?.user?.id || !session.user.role) {
    redirect("/login");
  }

  // Admin users go directly to dashboard
  if (session.user.role === "ADMIN") {
    redirect("/dashboard");
  }

  redirect(await getHomeRedirectPath(session.user.id));
}
