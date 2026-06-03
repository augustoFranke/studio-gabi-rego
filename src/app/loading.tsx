import { Loader2 } from 'lucide-react'

export default function Loading() {
    return (
        <div className="flex min-h-[400px] w-full items-center justify-center">
            <div className="flex flex-col items-center gap-2">
                <Loader2 className="size-10 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground animate-pulse">Carregando…</p>
            </div>
        </div>
    )
}
