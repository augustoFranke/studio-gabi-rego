"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"

type ImportResult = {
  createdCount: number
  skippedCount: number
  errors: { row: number; message: string }[]
  created: { nome: string; email: string; cpf: string; senhaTemporaria?: string }[]
}

export function MemberImportButton() {
  const router = useRouter()
  const [file, setFile] = useState<File | null>(null)
  const [open, setOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<ImportResult | null>(null)

  const hasGeneratedPasswords = useMemo(
    () => result?.created.some((row) => row.senhaTemporaria) ?? false,
    [result]
  )

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo CSV primeiro.")
      return
    }

    const formData = new FormData()
    formData.append("file", file)

    setUploading(true)
    setResult(null)

    try {
      const response = await fetch("/api/membros/import", {
        method: "POST",
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Não foi possível importar o CSV.")
      }

      setResult(data)
      router.refresh()

      toast.success(`Importação concluída: ${data.createdCount} membro(s) adicionados.`)
    } catch (error) {
      console.error(error)
      toast.error(error instanceof Error ? error.message : "Erro ao importar membros.")
    } finally {
      setUploading(false)
    }
  }

  const resetState = () => {
    setFile(null)
    setResult(null)
    setUploading(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) {
          resetState()
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Upload className="h-4 w-4" />
          Importar CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle>Importar membros via CSV</DialogTitle>
          <DialogDescription>
            Use este importador para trazer os membros que estão no sistema antigo. Apenas administradores podem usar esta opção.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 overflow-y-auto flex-1 pr-1">
          <div className="rounded-lg border bg-muted/50 p-4 text-sm space-y-3">
            <div className="flex items-center gap-2 font-medium">
              <FileSpreadsheet className="h-4 w-4 flex-shrink-0" />
              Formato esperado
            </div>
            <div className="space-y-2 text-muted-foreground text-xs">
              <p><strong className="text-foreground">Headers aceitos:</strong></p>
              <div className="flex flex-wrap gap-1">
                <code className="bg-background px-1.5 py-0.5 rounded text-xs">nome</code>
                <code className="bg-background px-1.5 py-0.5 rounded text-xs">email</code>
                <code className="bg-background px-1.5 py-0.5 rounded text-xs">cpf</code>
                <code className="bg-background px-1.5 py-0.5 rounded text-xs">telefone</code>
                <code className="bg-background px-1.5 py-0.5 rounded text-xs">data_nascimento</code>
                <code className="bg-background px-1.5 py-0.5 rounded text-xs">plano</code>
                <code className="bg-background px-1.5 py-0.5 rounded text-xs">plano_id</code>
                <code className="bg-background px-1.5 py-0.5 rounded text-xs">rg</code>
                <code className="bg-background px-1.5 py-0.5 rounded text-xs">status</code>
                <code className="bg-background px-1.5 py-0.5 rounded text-xs">senha</code>
              </div>
              <p className="pt-1"><strong className="text-foreground">Formatos de data:</strong> dd/mm/aaaa, dd-mm-aaaa ou aaaa-mm-dd</p>
              <p><strong className="text-foreground">Separador:</strong> vírgula ou ponto-e-vírgula (valores com vírgula entre aspas)</p>
            </div>
            <div className="rounded-md bg-background/80 border px-3 py-2 text-xs font-mono whitespace-pre overflow-x-auto">nome,email,cpf,telefone,data_nascimento,plano{"\n"}Maria Silva,maria@email.com,123.456.789-10,(11)99999-0000,12/03/1990,Mensal</div>
          </div>

          <div className="space-y-2">
            <Input
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => {
                const selected = event.target.files?.[0]
                setFile(selected ?? null)
              }}
            />
            {file && (
              <p className="text-xs text-muted-foreground">
                Arquivo selecionado: <span className="font-medium text-foreground">{file.name}</span>
              </p>
            )}
          </div>

          {result && (
            <div className="rounded-lg border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                <p className="text-sm font-medium">Resumo da importação</p>
              </div>
              <div className="flex flex-wrap gap-2 text-sm">
                <Badge variant="outline">Criados: {result.createdCount}</Badge>
                <Badge variant="outline">Ignorados: {result.skippedCount}</Badge>
                {hasGeneratedPasswords && (
                  <Badge variant="outline">Senhas temporárias geradas</Badge>
                )}
              </div>

              {result.created.length > 0 && (
                <div className="rounded-md bg-muted/50 p-3 text-xs space-y-1">
                  <p className="font-medium">Membros adicionados</p>
                  <ul className="space-y-1">
                    {result.created.map((row) => (
                      <li key={row.cpf} className="flex flex-col gap-0.5">
                        <span className="text-foreground">{row.nome} — {row.email}</span>
                        {row.senhaTemporaria && (
                          <span className="text-muted-foreground">Senha temporária: {row.senhaTemporaria}</span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {result.errors.length > 0 && (
                <div className="rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs space-y-1">
                  <div className="flex items-center gap-2 font-medium text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    Linhas com problema ({result.errors.length})
                  </div>
                  <ul className="space-y-1 text-destructive">
                    {result.errors.map((error) => (
                      <li key={`${error.row}-${error.message}`}>
                        Linha {error.row}: {error.message}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>
            Fechar
          </Button>
          <Button onClick={handleUpload} disabled={uploading}>
            {uploading ? "Importando..." : "Importar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

