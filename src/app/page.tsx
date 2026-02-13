import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Admin users go directly to dashboard
  if (session.user.role === "ADMIN") {
    redirect("/dashboard");
  }

  // For regular users, check onboarding status
  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    select: {
      etapaOnboarding: true,
      onboardingCompleto: true,
      membro: { select: { id: true } },
    },
  });

  // Redirect based on onboarding stage (legacy users only - new users complete everything before login)
  if (!usuario?.onboardingCompleto) {
    if (!usuario?.membro) {
      // No membro record - redirect to registration
      redirect("/cadastro");
    }
    // Has membro but onboarding not complete - mark as complete (legacy user who has data)
    await prisma.usuario.update({
      where: { id: session.user.id },
      data: { etapaOnboarding: 4, onboardingCompleto: true },
    });
  }

  // Onboarding complete - go to member dashboard
  redirect("/inicio");
}
