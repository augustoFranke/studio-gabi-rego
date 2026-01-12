'use client'

import { 
  DropdownMenuItem, 
} from "@/components/ui/dropdown-menu"
import { ShieldAlert, ShieldCheck, Send } from "lucide-react"
import { toggleMembroStatus, enviarLembreteBoasVindas } from "@/app/actions/membros"
import { toast } from "sonner"
import { useTransition } from "react"

interface MemberActionsProps {
  id: string
  status: string
}

export function MemberStatusToggle({ id, status }: MemberActionsProps) {
  const [isPending, startTransition] = useTransition()
  const isActive = status === 'ATIVO'

  const handleToggle = () => {
    startTransition(async () => {
      const result = await toggleMembroStatus(id, status)
      if (result.success) {
        toast.success(isActive ? "Membro desativado" : "Membro ativado")
      } else {
        toast.error(result.error || "Erro ao alterar status")
      }
    })
  }

  return (
    <DropdownMenuItem onClick={handleToggle} disabled={isPending}>
      {isActive ? (
        <>
          <ShieldAlert className="mr-2 h-4 w-4" />
          Desativar
        </>
      ) : (
        <>
          <ShieldCheck className="mr-2 h-4 w-4" />
          Ativar
        </>
      )}
    </DropdownMenuItem>
  )
}

export function SendMemberReminder({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition()

  const handleSend = () => {
    startTransition(async () => {
      const result = await enviarLembreteBoasVindas(id)
      if (result.success) {
        toast.success("Boas-vindas enviada com sucesso!")
      } else {
        toast.error(result.error || "Erro ao enviar lembrete")
      }
    })
  }

  return (
    <DropdownMenuItem onClick={handleSend} disabled={isPending}>
      <Send className="mr-2 h-4 w-4" />
      Enviar Boas-vindas
    </DropdownMenuItem>
  )
}

