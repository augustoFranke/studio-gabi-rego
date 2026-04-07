import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getHomeRedirectPath } from "@/services/onboarding.service";

export const dynamic = "force-dynamic";

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
