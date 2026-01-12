'use client'

import { useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { AlertCircle, RefreshCcw } from 'lucide-react'

export default function Error({
    error,
    reset,
}: {
    error: Error & { digest?: string }
    reset: () => void
}) {
    useEffect(() => {
        console.error(error)
    }, [error])

    return (
        <div className="flex min-h-[400px] w-full flex-col items-center justify-center gap-4 text-center p-6">
            <div className="rounded-full bg-destructive/10 p-4">
                <AlertCircle className="h-10 w-10 text-destructive" />
            </div>
            <div className="space-y-2">
                <h2 className="text-2xl font-bold tracking-tight">Ops! Algo deu errado</h2>
                <p className="text-muted-foreground max-w-[400px]">
                    Ocorreu um erro inesperado. Por favor, tente novamente ou entre em contato com o suporte se o problema persistir.
                </p>
            </div>
            <Button
                onClick={() => reset()}
                variant="outline"
                className="mt-2"
            >
                <RefreshCcw className="mr-2 h-4 w-4" />
                Tentar novamente
            </Button>
        </div>
    )
}
