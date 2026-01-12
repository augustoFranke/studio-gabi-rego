import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Redirecionar baseado no role do usuário
  if (session.user.role === "ADMIN") {
    redirect("/dashboard");
  } else {
    redirect("/meus-dados");
  }
}
