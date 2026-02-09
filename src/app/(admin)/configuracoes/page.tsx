'use client'

import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { fetcher, FetchError } from '@/lib/fetcher'

type Configuracao = {
  id: string
  chave: string
  valor: string
  descricao: string | null
  atualizadoEm: string
}

export default function ConfiguracoesPage() {
  const { data, isLoading, mutate } = useSWR<Configuracao[]>('/api/configuracoes', fetcher, {
    revalidateOnFocus: false,
  })
  const [values, setValues] = useState<Record<string, string>>({})
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!data) {
      return
    }

    const nextValues: Record<string, string> = {}
    for (const config of data) {
      nextValues[config.id] = config.valor
    }
    setValues(nextValues)
  }, [data])

  const handleSave = async () => {
    if (!data || data.length === 0) {
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const payload = {
        configuracoes: data.map((config) => ({
          id: config.id,
          valor: values[config.id] ?? '',
        })),
      }

      const response = await fetch('/api/configuracoes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => null)
        throw new FetchError(errorData?.error || 'Erro ao salvar', response.status, errorData)
      }

      const updated = (await response.json()) as Configuracao[]
      await mutate(updated, false)
      setMessage('Configurações salvas com sucesso.')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Erro ao salvar configurações'
      setMessage(text)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Configurações</h1>
        <p className="text-muted-foreground">Ajuste os parâmetros gerais do estúdio.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Configurações Gerais</CardTitle>
          <CardDescription>Esses valores impactam lembretes, comunicações e dados de contato.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!isLoading && data?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma configuração encontrada.</p>
          )}

          {!isLoading && data?.map((config) => (
            <div key={config.id} className="space-y-2">
              <Label htmlFor={config.id}>{config.chave}</Label>
              <Input
                id={config.id}
                value={values[config.id] ?? ''}
                onChange={(event) =>
                  setValues((current) => ({
                    ...current,
                    [config.id]: event.target.value,
                  }))
                }
              />
              {config.descricao && <p className="text-xs text-muted-foreground">{config.descricao}</p>}
            </div>
          ))}

          <div className="flex items-center justify-between gap-3 pt-2">
            <p className="text-sm text-muted-foreground">{message}</p>
            <Button onClick={handleSave} disabled={saving || isLoading || !data?.length}>
              {saving ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
