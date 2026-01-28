import { MemberForm } from "@/components/forms/MemberForm"
import { ChevronLeft } from "lucide-react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/prisma"
import { notFound } from "next/navigation"

export const dynamic = "force-dynamic"

interface EditarMembroPageProps {
    params: Promise<{
        id: string
    }>
}

export default async function EditarMembroPage({ params }: EditarMembroPageProps) {
    const { id } = await params

    const membro = await prisma.membro.findUnique({
        where: { id },
        select: {
            id: true,
            usuarioId: true,
            cpf: true,
            rg: true,
            telefone: true,
            dataNascimento: true,
            planoId: true,
            precoCustomizado: true,
            sexo: true,
            horariosFixos: {
                select: {
                    diaSemana: true,
                    hora: true,
                },
            },
            usuario: {
                select: {
                    nome: true,
                    email: true,
                },
            },
        },
    })

    if (!membro) {
        notFound()
    }

    const usuario = membro.usuario ?? { nome: null, email: null }
    const usuarioEmail =
        usuario.email && !usuario.email.endsWith("@placeholder.local")
            ? usuario.email
            : undefined

    // Transform Prisma null values to undefined for form compatibility
    const formData = {
        id: membro.id,
        usuarioId: membro.usuarioId,
        usuario: {
            nome: usuario.nome ?? undefined,
            email: usuarioEmail,
        },
        cpf: membro.cpf ?? undefined,
        rg: membro.rg ?? undefined,
        telefone: membro.telefone ?? undefined,
        dataNascimento: membro.dataNascimento?.toISOString() ?? undefined,
        planoId: membro.planoId ?? undefined,
        precoCustomizado: membro.precoCustomizado ? String(membro.precoCustomizado) : undefined,
        sexo: membro.sexo ?? undefined,
        horariosFixos: membro.horariosFixos.map((horario) => ({
            diaSemana: horario.diaSemana,
            hora: horario.hora,
        })),
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" asChild>
                    <Link href={`/alunos/${id}`}>
                        <ChevronLeft className="h-4 w-4" />
                    </Link>
                </Button>
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Editar Aluno</h1>
                    <p className="text-muted-foreground">
                        {usuario.nome ?? ""}
                    </p>
                </div>
            </div>

            <div className="max-w-4xl">
                <MemberForm initialData={formData} mode="edit" />
            </div>
        </div>
    )
}
