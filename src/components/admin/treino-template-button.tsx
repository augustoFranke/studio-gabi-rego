"use client"

import { useEffect, useState } from "react"
import { Bookmark } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "sonner"
import { readResponseErrorMessage } from "@/lib/http"

type TreinoTemplateButtonProps = {
  treinoId: string
  defaultName: string
}

export function TreinoTemplateButton({
  treinoId,
  defaultName,
}: TreinoTemplateButtonProps) {
  const [open, setOpen] = useState(false)
  const [templateName, setTemplateName] = useState(defaultName)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (open) {
      setTemplateName(defaultName)
    }
  }, [defaultName, open])

  const handleSave = async () => {
    const trimmed = templateName.trim()
    if (!trimmed) {
      toast.error("Informe um nome para o template.")
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch("/api/treinos/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fichaId: treinoId,
          nome: trimmed,
        }),
      })

      if (!response.ok) {
        throw new Error(await readResponseErrorMessage(response, "Erro ao salvar template"))
      }

      toast.success("Template salvo com sucesso!")
      setOpen(false)
    } catch (error) {
      console.error("Error saving template:", error)
      toast.error(error instanceof Error ? error.message : "Erro ao salvar template")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button variant="outline" className="gap-2" onClick={() => setOpen(true)}>
        <Bookmark className="h-4 w-4" />
        Salvar como Template
      </Button>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Salvar como template</DialogTitle>
          <DialogDescription>
            Use este template para aplicar o treino em outros alunos.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Input
            value={templateName}
            onChange={(event) => setTemplateName(event.target.value)}
            placeholder="Nome do template"
          />
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isSaving}
          >
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !templateName.trim()}>
            {isSaving ? "Salvando..." : "Salvar template"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
