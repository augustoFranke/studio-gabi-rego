"use client"

import { Button } from "@/components/ui/button"
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"

interface PaginationProps {
    currentPage: number
    totalPages: number
    className?: string
}

export function Pagination({ currentPage, totalPages, className }: PaginationProps) {
    const router = useRouter()
    const searchParams = useSearchParams()

    const createPageURL = (pageNumber: number | string) => {
        const params = new URLSearchParams(searchParams)
        params.set("page", pageNumber.toString())
        return `?${params.toString()}`
    }

    const navigateToPage = (pageNumber: number) => {
        router.push(createPageURL(pageNumber))
    }

    return (
        <div className={`flex items-center justify-between px-2 ${className}`}>
            <div className="flex-1 text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
            </div>
            <div className="flex items-center space-x-2">
                <Button
                    variant="outline"
                    className="h-8 w-8 p-0 lg:flex"
                    onClick={() => navigateToPage(1)}
                    disabled={currentPage === 1}
                >
                    <span className="sr-only">Primeira página</span>
                    <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => navigateToPage(currentPage - 1)}
                    disabled={currentPage === 1}
                >
                    <span className="sr-only">Página anterior</span>
                    <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    className="h-8 w-8 p-0"
                    onClick={() => navigateToPage(currentPage + 1)}
                    disabled={currentPage === totalPages}
                >
                    <span className="sr-only">Próxima página</span>
                    <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                    variant="outline"
                    className="h-8 w-8 p-0 lg:flex"
                    onClick={() => navigateToPage(totalPages)}
                    disabled={currentPage === totalPages}
                >
                    <span className="sr-only">Última página</span>
                    <ChevronsRight className="h-4 w-4" />
                </Button>
            </div>
        </div>
    )
}
