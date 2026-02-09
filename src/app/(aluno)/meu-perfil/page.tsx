'use client'

import { FormEvent, useEffect, useState } from 'react'
import useSWR from 'swr'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { fetcher } from '@/lib/fetcher'

type PerfilData = {
  id: string
  nome: string
  email: string
  telefone: string | null
  dataNascimento: string | null
  sexo: 'MASCULINO' | 'FEMININO' | null
}

type FormDataState = {
  nome: string
  telefone: string
  dataNascimento: string
  sexo: '' | 'MASCULINO' | 'FEMININO'
}

function toDateInputValue(value: string | null) {
  if (!value) {
    return ''
  }

  return value.slice(0, 10)
}

export default function MeuPerfilPage() {
  const { data, isLoading, mutate } = useSWR<PerfilData>('/api/perfil', fetcher, {
    revalidateOnFocus: false,
  })
  const [formData, setFormData] = useState<FormDataState>({
    nome: '',
    telefone: '',
    dataNascimento: '',
    sexo: '',
  })
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!data) {
      return
    }

    setFormData({
      nome: data.nome || '',
      telefone: data.telefone || '',
      dataNascimento: toDateInputValue(data.dataNascimento),
      sexo: data.sexo || '',
    })
  }, [data])

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    try {
      const response = await fetch('/api/perfil', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome: formData.nome,
          telefone: formData.telefone,
          dataNascimento: formData.dataNascimento,
          sexo: formData.sexo,
        }),
      })

      const payload = await response.json().catch(() => null)

      if (!response.ok) {
        throw new Error(payload?.error || 'Erro ao salvar perfil')
      }

      await mutate()
      setMessage('Perfil atualizado com sucesso.')
    } catch (error) {
      const text = error instanceof Error ? error.message : 'Erro ao atualizar perfil'
      setMessage(text)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Meu Perfil</h1>
        <p className="text-muted-foreground">Atualize seus dados pessoais.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Dados Cadastrais</CardTitle>
          <CardDescription>As informações abaixo são usadas na sua ficha e comunicação.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          )}

          {!isLoading && (
            <form className="space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(event) => setFormData((current) => ({ ...current, nome: event.target.value }))}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" value={data?.email || ''} disabled />
              </div>

              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input
                  id="telefone"
                  value={formData.telefone}
                  onChange={(event) => setFormData((current) => ({ ...current, telefone: event.target.value }))}
                  placeholder="(65) 99999-9999"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="dataNascimento">Data de nascimento</Label>
                <Input
                  id="dataNascimento"
                  type="date"
                  value={formData.dataNascimento}
                  onChange={(event) =>
                    setFormData((current) => ({
                      ...current,
                      dataNascimento: event.target.value,
                    }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>Sexo</Label>
                <Select
                  value={formData.sexo || undefined}
                  onValueChange={(value: 'MASCULINO' | 'FEMININO') =>
                    setFormData((current) => ({ ...current, sexo: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MASCULINO">Masculino</SelectItem>
                    <SelectItem value="FEMININO">Feminino</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between gap-3 pt-2">
                <p className="text-sm text-muted-foreground">{message}</p>
                <Button type="submit" disabled={saving}>
                  {saving ? 'Salvando...' : 'Salvar'}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
