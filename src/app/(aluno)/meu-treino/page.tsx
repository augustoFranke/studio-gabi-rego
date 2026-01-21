import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Download, Dumbbell } from "lucide-react"

export default function MeuTreinoPage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Meu Treino</h1>
          <p className="text-muted-foreground">
            Sua ficha de treino atual
          </p>
        </div>
        <Button variant="outline" className="hover:bg-primary/10 hover:text-primary hover:border-primary/30">
          <Download className="mr-2 h-4 w-4 text-primary" />
          Baixar PDF
        </Button>
      </div>

      <Card className="border-primary/10">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Dumbbell className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Ficha de Treino</CardTitle>
              <CardDescription>
                Exercícios prescritos pelo seu instrutor
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Dumbbell className="h-7 w-7 text-primary" />
            </div>
            <p className="text-muted-foreground text-center">
              Nenhuma ficha de treino cadastrada.
            </p>
            <p className="text-sm text-muted-foreground/70 text-center mt-1">
              Sua ficha de treino aparecerá aqui quando for criada.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
