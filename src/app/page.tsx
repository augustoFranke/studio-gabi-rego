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
    select: { etapaOnboarding: true, onboardingCompleto: true },
  });

  // Redirect based on onboarding stage
  if (!usuario?.onboardingCompleto) {
    const stage = usuario?.etapaOnboarding ?? 1;

    if (stage < 3) {
      // Profile not completed yet
      redirect("/completar-perfil");
    } else if (stage === 3) {
      // Profile done, anamnese pending
      redirect("/anamnese");
    }
  }

  // Onboarding complete - go to member dashboard
  redirect("/inicio");
}
