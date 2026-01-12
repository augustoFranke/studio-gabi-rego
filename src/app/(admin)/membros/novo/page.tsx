import { MemberForm } from "@/components/forms/MemberForm"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"

export default function NovoMembroPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/membros">
            <ChevronLeft className="h-4 w-4" />
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Novo Membro</h1>
          <p className="text-muted-foreground">
            Adicione um novo membro ao sistema
          </p>
        </div>
      </div>

      <div className="max-w-4xl">
        <MemberForm />
      </div>
    </div>
  )
}

