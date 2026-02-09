'use client'

import { useMemo, useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Download, Dumbbell } from 'lucide-react'
import { fetcher } from '@/lib/fetcher'

type Exercicio = {
  id: string
  sessao: string
  nome: string
  grupoMuscular?: string | null
  series: string
  repeticoes: string
  descanso?: string | null
}

type FichaTreino = {
  id: string
  nome: string
  data?: string | null
  objetivo?: string | null
  criadoEm: string
  exercicios: Exercicio[]
}

export default function MeuTreinoPage() {
  const { data: fichas = [], isLoading } = useSWR<FichaTreino[]>(
    '/api/treinos?ativos=true',
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 5000,
    }
  )
  const [downloading, setDownloading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fichaAtual = fichas[0]

  const sessoes = useMemo(() => {
    if (!fichaAtual) {
      return [] as Array<{ id: string; exercicios: Exercicio[] }>
    }

    const grouped = new Map<string, Exercicio[]>()
    for (const exercicio of fichaAtual.exercicios) {
      const sessao = exercicio.sessao || 'A'
      if (!grouped.has(sessao)) {
        grouped.set(sessao, [])
      }
      grouped.get(sessao)?.push(exercicio)
    }

    return Array.from(grouped.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([id, exercicios]) => ({ id, exercicios }))
  }, [fichaAtual])

  const handleDownloadPdf = async () => {
    if (!fichaAtual) {
      return
    }

    setDownloading(true)
    setError(null)

    try {
      const response = await fetch(`/api/treinos/${fichaAtual.id}/pdf`)
      if (!response.ok) {
        throw new Error('Não foi possível baixar o PDF')
      }

      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      const anchor = document.createElement('a')
      anchor.href = url
      anchor.download = `treino-${fichaAtual.nome}.pdf`
      document.body.appendChild(anchor)
      anchor.click()
      anchor.remove()
      URL.revokeObjectURL(url)
    } catch (downloadError) {
      const message = downloadError instanceof Error ? downloadError.message : 'Erro ao baixar PDF'
      setError(message)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu Treino</h1>
          <p className="text-muted-foreground">Sua ficha de treino ativa</p>
        </div>
        <Button
          variant="outline"
          onClick={handleDownloadPdf}
          disabled={!fichaAtual || downloading || isLoading}
          className="hover:bg-primary/10 hover:text-primary hover:border-primary/30"
        >
          <Download className="mr-2 h-4 w-4 text-primary" />
          {downloading ? 'Baixando...' : 'Baixar PDF'}
        </Button>
      </div>

      {isLoading && (
        <Card>
          <CardHeader>
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-5 w-64" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      )}

      {!isLoading && !fichaAtual && (
        <Card className="border-primary/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Ficha de Treino</CardTitle>
                <CardDescription>Exercícios prescritos pelo seu instrutor</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <Dumbbell className="h-7 w-7 text-primary" />
              </div>
              <p className="text-muted-foreground text-center">Nenhuma ficha de treino cadastrada.</p>
              <p className="text-sm text-muted-foreground/70 text-center mt-1">
                Sua ficha de treino aparecerá aqui quando for criada.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {!isLoading && fichaAtual && (
        <Card className="border-primary/10">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Dumbbell className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>{fichaAtual.nome}</CardTitle>
                <CardDescription>Exercícios organizados por sessão</CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 pt-2">
              {fichaAtual.objetivo && <Badge variant="secondary">Objetivo: {fichaAtual.objetivo}</Badge>}
              {fichaAtual.data && <Badge variant="outline">Data: {fichaAtual.data}</Badge>}
            </div>
          </CardHeader>
          <CardContent>
            {sessoes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Essa ficha ainda não possui exercícios.</p>
            ) : (
              <Tabs defaultValue={sessoes[0].id} className="space-y-4">
                <TabsList>
                  {sessoes.map((sessao) => (
                    <TabsTrigger key={sessao.id} value={sessao.id}>
                      Sessão {sessao.id}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {sessoes.map((sessao) => (
                  <TabsContent key={sessao.id} value={sessao.id} className="space-y-3">
                    {sessao.exercicios.map((exercicio) => (
                      <div key={exercicio.id} className="rounded-lg border p-4 space-y-2">
                        <p className="font-medium">{exercicio.nome}</p>
                        <div className="grid grid-cols-2 gap-2 text-sm text-muted-foreground md:grid-cols-4">
                          <p>Grupo: {exercicio.grupoMuscular || 'Não informado'}</p>
                          <p>Séries: {exercicio.series}</p>
                          <p>Repetições: {exercicio.repeticoes}</p>
                          <p>Descanso: {exercicio.descanso || '-'}</p>
                        </div>
                      </div>
                    ))}
                  </TabsContent>
                ))}
              </Tabs>
            )}

            {error && <p className="text-sm text-destructive mt-4">{error}</p>}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
