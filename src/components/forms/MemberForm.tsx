"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { toast } from "sonner"
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
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { validarCPF, formatarCPF, formatarTelefone } from "@/lib/validators"

const formSchema = z.object({
  nome: z.string().optional(),
  email: z.string().email("Email inválido").optional().or(z.literal('')),
  senha: z.string().optional(),
  cpf: z.string().min(1, "CPF é obrigatório").refine((val) => validarCPF(val), {
    message: "CPF inválido",
  }),
  rg: z.string().optional(),
  telefone: z.string().optional(),
  dataNascimento: z.string().optional(),
  planoId: z.string().optional(),
  precoCustomizado: z.union([z.string(), z.number(), z.null()]).optional(),
  sexo: z.enum(["MASCULINO", "FEMININO"]).optional(),
})

type FormValues = z.infer<typeof formSchema>

interface Plano {
  id: string
  nome: string
  valor: number
}

export function MemberForm({
  initialData,
  mode = 'create'
}: {
  initialData?: any,
  mode?: 'create' | 'edit'
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [planos, setPlanos] = useState<Plano[]>([])

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: initialData?.usuario?.nome || "",
      email: initialData?.usuario?.email || "",
      senha: "", // Senha não é preenchida na edição
      cpf: initialData?.cpf ? formatarCPF(initialData.cpf) : "",
      rg: initialData?.rg || "",
      telefone: initialData?.telefone ? formatarTelefone(initialData.telefone) : "",
      dataNascimento: initialData?.dataNascimento ? new Date(initialData.dataNascimento).toISOString().split('T')[0] : "",
      planoId: initialData?.planoId || "",
      precoCustomizado: initialData?.precoCustomizado ? String(initialData.precoCustomizado) : "",
      sexo: initialData?.sexo || "",
    },
  })

  // Remover validação obrigatória de senha na edição
  useEffect(() => {
    if (mode === 'edit') {
      // Na edição, a senha é opcional. Se vazia, não altera.
      // O schema original exige min(6). Precisamos ajustar o schema dinamicamente ou aceitar que
      // para edição usamos um schema levemente diferente.
      // Pela simplicidade, vamos manter a validação visual mas no submit removemos se vazio.
      // Mas o zodResolver vai bloquear. 
      // Solução: Criar schema dinâmico ou ignorar validação de senha se vazia na edição.
    }
  }, [mode])

  // Ajuste do schema para edição (senha opcional)
  const activeSchema = mode === 'edit'
    ? formSchema.extend({ senha: z.string().optional() })
    : formSchema;

  // Atualizar resolver com schema correto
  // Nota: mudar o resolver dinamicamente no hook-form pode ser tricky.
  // Melhor abordagem: schema único com refine ou preprocess?
  // Ou simplesmente passar o schema correto no useForm, mas aqui já iniciamos.

  useEffect(() => {
    const fetchPlanos = async () => {
      try {
        const response = await fetch("/api/planos")
        if (response.ok) {
          const data = await response.json()
          setPlanos(data)
        }
      } catch (error) {
        console.error("Erro ao carregar planos:", error)
      }
    }
    fetchPlanos()
  }, [])

  async function onSubmit(values: FormValues) {
    setLoading(true)
    try {
      const url = mode === 'create' ? "/api/membros" : `/api/membros/${initialData.id}`
      const method = mode === 'create' ? "POST" : "PATCH"

      // Limpar campos opcionais vazios
      const body = { ...values } as any
      if (mode === 'edit' && !body.senha) {
        delete body.senha
      }
      if (body.precoCustomizado === "") {
        body.precoCustomizado = null
      }
      if (body.sexo === "") {
        delete body.sexo
      }

      console.log('Sending body:', body) // Debug

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || "Erro ao salvar membro")
      }

      toast.success(mode === 'create' ? "Membro cadastrado com sucesso!" : "Membro atualizado com sucesso!")
      router.push(mode === 'create' ? "/membros" : `/membros/${initialData.id}`)
      router.refresh()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Erro ao salvar membro")
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

  // Custom resolver to handle optional password in edit mode
  const customResolver = async (values: any, context: any, options: any) => {
    const schema = mode === 'edit'
      ? formSchema.extend({ senha: z.string().min(6, "Senha muito curta").optional().or(z.literal('')) })
      : formSchema;

    return zodResolver(schema)(values, context, options);
  }

  // Re-register form with custom resolver? Not easy.
  // Instead, let's just accept that we use a relaxed schema for everything or handle it in the Submit.
  // Actually, we can pass `context` to schema maybe?
  // Let's modify the ORIGINAL schema definition outside component to be more flexible, or use a trick.

  return (
    <Card>
      <CardHeader>
        <CardTitle>{mode === 'create' ? 'Dados do Membro' : 'Editar Membro'}</CardTitle>
        <CardDescription>
          {mode === 'create' ? 'Preencha os dados abaixo para cadastrar um novo membro.' : 'Atualize os dados do membro.'}
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

              <FormField
                control={form.control}
                name="senha"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{mode === 'edit' ? 'Nova Senha (Opcional)' : 'Senha de Acesso'}</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder={mode === 'edit' ? "Deixe em branco para manter" : "******"} {...field} />
                    </FormControl>
                    <FormDescription>
                      {mode === 'create' ? "Senha que o membro usará para acessar o sistema." : "Preencha apenas se quiser alterar a senha."}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

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

              <FormField
                control={form.control}
                name="planoId"
                render={({ field }) => {
                  const planosGabi = planos.filter(p => p.nome.toLowerCase().includes('gabi'))
                  const planosEstagiarios = planos.filter(p => p.nome.toLowerCase().includes('estagiário') || p.nome.toLowerCase().includes('estagiarios'))
                  const planosOutros = planos.filter(p => !p.nome.toLowerCase().includes('gabi') && !p.nome.toLowerCase().includes('estagiário') && !p.nome.toLowerCase().includes('estagiarios'))

                  return (
                    <FormItem>
                      <FormLabel>Plano</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione um plano" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {planosGabi.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-amber-500"></span>
                                Planos com Gabi
                              </SelectLabel>
                              {planosGabi.map((plano) => (
                                <SelectItem key={plano.id} value={plano.id} className="pl-6">
                                  <span className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>
                                    {plano.nome} - R$ {Number(plano.valor).toFixed(2)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {planosEstagiarios.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-sky-500"></span>
                                Planos com Estagiários
                              </SelectLabel>
                              {planosEstagiarios.map((plano) => (
                                <SelectItem key={plano.id} value={plano.id} className="pl-6">
                                  <span className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-sky-400"></span>
                                    {plano.nome} - R$ {Number(plano.valor).toFixed(2)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {planosOutros.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="flex items-center gap-2">
                                <span className="h-2 w-2 rounded-full bg-violet-500"></span>
                                Outros Planos
                              </SelectLabel>
                              {planosOutros.map((plano) => (
                                <SelectItem key={plano.id} value={plano.id} className="pl-6">
                                  <span className="flex items-center gap-2">
                                    <span className="h-1.5 w-1.5 rounded-full bg-violet-400"></span>
                                    {plano.nome} - R$ {Number(plano.valor).toFixed(2)}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )
                }}
              />

              <FormField
                control={form.control}
                name="precoCustomizado"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Valor Personalizado (R$)</FormLabel>
                    <FormControl>
                      <Input
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
                {loading ? "Salvando..." : (mode === 'create' ? "Cadastrar Membro" : "Salvar Alterações")}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

