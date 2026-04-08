"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useFieldArray, useForm } from "react-hook-form"
import useSWR from "swr"
import * as z from "zod"
import { toast } from "sonner"
import { fetcher } from "@/lib/fetcher"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SearchableSelect,
  type SearchableSelectOption,
} from "@/components/ui/searchable-select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { validarCPF, formatarCPF, formatarTelefone } from "@/lib/validators"
import { DiaSemanaLabel, HOURS, formatHour } from "@/lib/schedule"
import { groupPlansByCategory } from "@/lib/planos"

const formSchema = z.object({
  nome: z.string().optional(),
  email: z.string()
    .email("Por favor, insira um endereço de email válido.")
    .optional()
    .or(z.literal('')),
  senha: z.string().optional(),
  cpf: z.string()
    .optional()
    .refine((val) => !val || validarCPF(val), {
      message: "O CPF informado é inválido. Verifique os números digitados.",
    }),
  rg: z.string().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  planoId: z.string().optional(),
  precoCustomizado: z.union([
    z.string().transform((val) => val === '' ? null : val), 
    z.number(), 
    z.null()
  ]).optional(),
  sexo: z.enum(["MASCULINO", "FEMININO"], {
    message: "Por favor, selecione uma opção de sexo.",
  }).optional(),
  horariosFixos: z.array(z.object({
    diaSemana: z.enum(["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"]),
    hora: z.string().min(1),
  })).optional(),
})

type FormValues = z.infer<typeof formSchema>

interface Plano {
  id: string
  nome: string
  valor: number
}

const DIAS_SEMANA = ["SEGUNDA", "TERCA", "QUARTA", "QUINTA", "SEXTA", "SABADO", "DOMINGO"] as const

function getDefaultValues(initialData?: {
  id: string
  usuarioId?: string
  usuario?: {
    nome?: string
    email?: string
  }
  cpf?: string
  rg?: string
  telefone?: string
  dataNascimento?: string
  planoId?: string
  precoCustomizado?: string | number | null
  sexo?: 'MASCULINO' | 'FEMININO' | null
  horariosFixos?: {
    diaSemana: typeof DIAS_SEMANA[number]
    hora: string
  }[]
}): FormValues {
  return {
    nome: initialData?.usuario?.nome || "",
    email: initialData?.usuario?.email || "",
    senha: "",
    cpf: initialData?.cpf ? formatarCPF(initialData.cpf) : "",
    rg: initialData?.rg || "",
    telefone: initialData?.telefone ? formatarTelefone(initialData.telefone) : "",
    dataNascimento: initialData?.dataNascimento
      ? new Date(initialData.dataNascimento).toISOString().split('T')[0]
      : "",
    planoId: initialData?.planoId || "",
    precoCustomizado: initialData?.precoCustomizado ? String(initialData.precoCustomizado) : "",
    sexo: initialData?.sexo || undefined,
    horariosFixos: initialData?.horariosFixos ?? [],
  }
}

export function MemberForm({
  initialData,
  mode = 'create'
}: {
  initialData?: {
    id: string
    usuarioId?: string
    usuario?: {
      nome?: string
      email?: string
    }
    cpf?: string
    rg?: string
    telefone?: string
    dataNascimento?: string
    planoId?: string
    precoCustomizado?: string | number | null
    sexo?: 'MASCULINO' | 'FEMININO' | null
    horariosFixos?: {
      diaSemana: typeof DIAS_SEMANA[number]
      hora: string
    }[]
  },
  mode?: 'create' | 'edit'
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sendingResetLink, setSendingResetLink] = useState(false)
  // Use SWR for planos with long cache (rarely changes)
  const { data: planos = [] } = useSWR<Plano[]>("/api/planos", fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 300000, // 5 minutes - planos rarely change
  })

  const { planosGabi, planosEstagiarios, planosOutros } = useMemo(
    () => groupPlansByCategory(planos),
    [planos]
  )
  const planoOptions = useMemo<SearchableSelectOption[]>(
    () => [
      ...planosGabi.map((plano) => ({
        value: plano.id,
        label: `${plano.nome} - R$ ${Number(plano.valor).toFixed(2)}`,
        keywords: [plano.nome, "gabi"],
        group: "Planos com Gabi",
      })),
      ...planosEstagiarios.map((plano) => ({
        value: plano.id,
        label: `${plano.nome} - R$ ${Number(plano.valor).toFixed(2)}`,
        keywords: [plano.nome, "estagiario", "estagiários"],
        group: "Planos com Estagiários",
      })),
      ...planosOutros.map((plano) => ({
        value: plano.id,
        label: `${plano.nome} - R$ ${Number(plano.valor).toFixed(2)}`,
        keywords: [plano.nome],
        group: "Outros Planos",
      })),
    ],
    [planosEstagiarios, planosGabi, planosOutros]
  )

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getDefaultValues(initialData),
  })

  const horariosFixosFieldArray = useFieldArray({
    control: form.control,
    name: "horariosFixos",
  })

  useEffect(() => {
    form.reset(getDefaultValues(initialData))
  }, [form, initialData])

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const url = mode === 'create' ? "/api/membros" : `/api/membros/${initialData!.id}`
      const method = mode === 'create' ? "POST" : "PATCH"

      // Limpar campos opcionais vazios
      const body = { ...values }
      if (mode === 'edit' && !body.senha) {
        delete body.senha
      }
      if (body.precoCustomizado === "") {
        body.precoCustomizado = null
      }
      if (body.sexo === undefined) {
        delete body.sexo
      }
      if (body.cpf === "") {
        (body as Record<string, unknown>).cpf = null // Enviar null se vazio para permitir CPF opcional
      }

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Ocorreu um erro ao processar sua solicitação.")
      }

      toast.success(mode === 'create' ? "Aluno cadastrado com sucesso!" : "Dados do aluno atualizados com sucesso!")
      router.push(mode === 'create' ? "/alunos" : `/alunos/${initialData!.id}`)
      router.refresh()
    } catch (error) {
      console.error("Erro no formulário:", error)
      const errorMessage = error instanceof Error ? error.message : "Ocorreu um erro inesperado. Tente novamente."
      
      // Tradução de mensagens comuns se necessário (caso venham do backend em inglês ou genéricas)
      let displayMessage = errorMessage
      if (errorMessage.includes("Email already exists")) displayMessage = "Este email já está sendo utilizado por outro aluno."
      if (errorMessage.includes("CPF already exists")) displayMessage = "Este CPF já está cadastrado no sistema."
      if (errorMessage.includes("Invalid input")) displayMessage = "Verifique os dados informados e tente novamente."
      
      toast.error(displayMessage)
    } finally {
      setLoading(false)
    }
  }

  const handleCPFChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatarCPF(e.target.value)
    form.setValue("cpf", formatted, { shouldValidate: true })
  }

  const handleTelefoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatarTelefone(e.target.value)
    form.setValue("telefone", formatted, { shouldValidate: true })
  }

  const handleSendPasswordLink = async () => {
    if (!initialData?.usuarioId) {
      toast.error("Não foi possível identificar o usuário")
      return
    }

    setSendingResetLink(true)
    try {
      const response = await fetch("/api/auth/enviar-reset-senha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuarioId: initialData.usuarioId }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao enviar link")
      }

      toast.success("Link de redefinição de senha enviado para o email do aluno!")
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erro ao enviar link de redefinição"
      toast.error(message)
    } finally {
      setSendingResetLink(false)
    }
  }



  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Dados do Aluno' : 'Editar Aluno'}</CardTitle>
        <CardDescription>
          {mode === 'create' ? 'Preencha os dados abaixo para cadastrar um novo aluno.' : 'Atualize os dados do aluno.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="nome"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome Completo</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: João Silva" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="Ex: joao@email.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <FormField
                  control={form.control}
                  name="senha"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{mode === 'edit' ? 'Nova Senha (Opcional)' : 'Senha de Acesso'}</FormLabel>
                      <div className="flex gap-2">
                        <FormControl>
                          <Input type="password" placeholder={mode === 'edit' ? "Deixe em branco para manter" : "******"} {...field} />
                        </FormControl>
                        {mode === 'edit' && initialData?.usuarioId && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={handleSendPasswordLink}
                            disabled={sendingResetLink}
                            title="Enviar link de redefinição de senha por email"
                          >
                            {sendingResetLink ? "Enviando..." : "Enviar Link"}
                          </Button>
                        )}
                      </div>
                      <FormDescription>
                        {mode === 'create' ? "Senha que o aluno usará para acessar o sistema." : "Preencha apenas se quiser alterar a senha."}
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="cpf"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPF</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="000.000.000-00"
                        {...field}
                        onChange={handleCPFChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rg"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RG</FormLabel>
                    <FormControl>
                      <Input placeholder="Ex: 12.345.678-9" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="telefone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Telefone</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="(00) 00000-0000"
                        {...field}
                        onChange={handleTelefoneChange}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="dataNascimento"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Data de Nascimento</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="sexo"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Sexo</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o sexo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="FEMININO">Feminino</SelectItem>
                        <SelectItem value="MASCULINO">Masculino</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-6 md:col-span-2 md:grid-cols-2">
              <FormField
                control={form.control}
                name="planoId"
                render={({ field }) => {
                  return (
                    <FormItem>
                      <FormLabel>Plano</FormLabel>
                      <FormControl>
                        <SearchableSelect
                          value={field.value}
                          onValueChange={field.onChange}
                          options={planoOptions}
                          placeholder="Selecione um plano"
                          searchPlaceholder="Buscar plano..."
                          emptyMessage="Nenhum plano encontrado."
                          disabled={planos.length === 0}
                          className="border-input"
                          renderOption={(option) => {
                            const dotClass =
                              option.group === "Planos com Gabi"
                                ? "bg-amber-400"
                                : option.group === "Planos com Estagiários"
                                  ? "bg-sky-400"
                                  : option.group === "Outros Planos"
                                    ? "bg-violet-400"
                                    : null

                            if (!dotClass) {
                              return option.label
                            }

                            return (
                              <span className="flex items-center gap-2">
                                <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
                                {option.label}
                              </span>
                            )
                          }}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />

              <FormField
                control={form.control}
                name="precoCustomizado"
                render={({ field }) => (
                  <FormItem className="md:pt-6">
                    <FormLabel>Valor Personalizado (R$)</FormLabel>
                    <FormControl>
                      <Input
                        className="md:mt-0.5"
                        placeholder="Opcional - Substitui o valor do plano"
                        type="number"
                        step="0.01"
                        {...field}
                        value={field.value ?? ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          field.onChange(val === '' ? null : Number(val));
                        }}
                      />
                    </FormControl>
                    <FormDescription>
                      Se definido, este valor será cobrado ao invés do valor do plano.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold">Dias de Treino Fixo</h3>
                <p className="text-sm text-muted-foreground">
                  Defina os dias e horários que o aluno treina regularmente.
                </p>
              </div>
              <div className="space-y-3">
                {horariosFixosFieldArray.fields.map((item, index) => (
                  <div key={item.id} className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-end">
                    <FormField
                      control={form.control}
                      name={`horariosFixos.${index}.diaSemana`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Dia da Semana</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o dia" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {DIAS_SEMANA.map((dia) => (
                                <SelectItem key={dia} value={dia}>
                                  {DiaSemanaLabel[dia]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name={`horariosFixos.${index}.hora`}
                      render={({ field }) => (
                        <FormItem className="flex-1">
                          <FormLabel>Horário</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o horário" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {HOURS.map((hour) => {
                                const label = formatHour(hour)
                                return (
                                  <SelectItem key={label} value={label}>
                                    {label}
                                  </SelectItem>
                                )
                              })}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => horariosFixosFieldArray.remove(index)}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => horariosFixosFieldArray.append({
                    diaSemana: "SEGUNDA",
                    hora: formatHour(HOURS[0]),
                  })}
                >
                  Adicionar horário fixo
                </Button>
              </div>
            </div>

            <div className="flex justify-end gap-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : (mode === 'create' ? "Cadastrar Aluno" : "Salvar Alterações")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}
