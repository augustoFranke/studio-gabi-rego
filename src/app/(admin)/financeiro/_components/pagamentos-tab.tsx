import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { TabsContent } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DollarSign,
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react"
import type { SearchableSelectOption } from "@/components/ui/searchable-select"
import { PagamentoRow } from "./pagamento-row"
import { PagamentoDialog, type PagamentoForm } from "./pagamento-dialog"
import { DeletePagamentoDialog } from "./delete-pagamento-dialog"
import type { Pagamento, Plano } from "./types"

type PagamentosTabProps = {
  pagamentos: Pagamento[]
  searchPagamento: string
  setSearchPagamento: (value: string) => void
  filterStatus: string
  setFilterStatus: (value: string) => void
  sortPagamento: string
  setSortPagamento: (value: string) => void
  currentPage: number
  totalPages: number
  loadingPagamentos: boolean
  fetchPagamentos: (page?: number, search?: string, status?: string, sort?: string) => void
  onEditPagamento: (pagamento: Pagamento) => void
  onUpdatePagamentoStatus: (pagamento: Pagamento, newStatus: Pagamento["status"]) => void
  onDeletePagamento: (pagamento: Pagamento) => void
  pagamentoDialogOpen: boolean
  setPagamentoDialogOpen: (open: boolean) => void
  editingPagamento: Pagamento | null
  pagamentoForm: PagamentoForm
  setPagamentoForm: React.Dispatch<React.SetStateAction<PagamentoForm>>
  pagamentoErrors: Record<string, string>
  setPagamentoErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>
  submitting: boolean
  planos: Plano[]
  pagamentoMembroOptions: SearchableSelectOption[]
  pagamentoPlanoOptions: SearchableSelectOption[]
  getMemberPlanDefaults: (memberId: string) => { planoId: string; valor: string }
  getMemberNextBillingDate: (memberId: string) => Promise<string | null>
  onNewPagamento: () => void
  onSavePagamento: () => void
  showDeletePagamentoDialog: boolean
  setShowDeletePagamentoDialog: (open: boolean) => void
  pagamentoToDelete: Pagamento | null
  deletingPagamento: boolean
  onCancelDeletePagamento: () => void
  onConfirmDeletePagamento: () => void
}

export function PagamentosTab({
  pagamentos,
  searchPagamento,
  setSearchPagamento,
  filterStatus,
  setFilterStatus,
  sortPagamento,
  setSortPagamento,
  currentPage,
  totalPages,
  loadingPagamentos,
  fetchPagamentos,
  onEditPagamento,
  onUpdatePagamentoStatus,
  onDeletePagamento,
  pagamentoDialogOpen,
  setPagamentoDialogOpen,
  editingPagamento,
  pagamentoForm,
  setPagamentoForm,
  pagamentoErrors,
  setPagamentoErrors,
  submitting,
  planos,
  pagamentoMembroOptions,
  pagamentoPlanoOptions,
  getMemberPlanDefaults,
  getMemberNextBillingDate,
  onNewPagamento,
  onSavePagamento,
  showDeletePagamentoDialog,
  setShowDeletePagamentoDialog,
  pagamentoToDelete,
  deletingPagamento,
  onCancelDeletePagamento,
  onConfirmDeletePagamento,
}: PagamentosTabProps) {
  return (
    <TabsContent value="pagamentos" className="space-y-4">
      <Card className="border-primary/10">
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <DollarSign className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle>Pagamentos</CardTitle>
                <CardDescription>
                  Controle de pagamentos dos alunos
                </CardDescription>
              </div>
            </div>
            <PagamentoDialog
              open={pagamentoDialogOpen}
              onOpenChange={setPagamentoDialogOpen}
              editingPagamento={editingPagamento}
              pagamentoForm={pagamentoForm}
              setPagamentoForm={setPagamentoForm}
              pagamentoErrors={pagamentoErrors}
              setPagamentoErrors={setPagamentoErrors}
              submitting={submitting}
              planos={planos}
              pagamentoMembroOptions={pagamentoMembroOptions}
              pagamentoPlanoOptions={pagamentoPlanoOptions}
              getMemberPlanDefaults={getMemberPlanDefaults}
              getMemberNextBillingDate={getMemberNextBillingDate}
              onNew={onNewPagamento}
              onSave={onSavePagamento}
            />

            {/* Delete Confirmation Dialog */}
            <DeletePagamentoDialog
              open={showDeletePagamentoDialog}
              onOpenChange={setShowDeletePagamentoDialog}
              pagamentoToDelete={pagamentoToDelete}
              deletingPagamento={deletingPagamento}
              onCancel={onCancelDeletePagamento}
              onConfirm={onConfirmDeletePagamento}
            />
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                value={searchPagamento}
                onChange={(e) => setSearchPagamento(e.target.value)}
                className="pl-9 border-input/50 focus:border-primary"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[180px] border-input/50">
                <SelectValue placeholder="Filtrar status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="PENDENTE">Pendentes</SelectItem>
                <SelectItem value="PAGO">Pagos</SelectItem>
                <SelectItem value="ATRASADO">Atrasados</SelectItem>
                <SelectItem value="CANCELADO">Cancelados</SelectItem>
              </SelectContent>
            </Select>
            <Select value={sortPagamento} onValueChange={setSortPagamento}>
              <SelectTrigger className="w-[200px] border-input/50">
                <SelectValue placeholder="Ordenar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vencimento_desc">Vencimento (mais distante)</SelectItem>
                <SelectItem value="vencimento_asc">Vencimento (mais próximo)</SelectItem>
                <SelectItem value="recent_desc">Mais recentes</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {pagamentos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center mb-3">
                <DollarSign className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Nenhum pagamento encontrado.
              </p>
            </div>
          ) : (
            <div className="rounded-md border border-border/50">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead>Aluno</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagamentos.map((pagamento) => (
                    <PagamentoRow
                      key={pagamento.id}
                      pagamento={pagamento}
                      onEdit={onEditPagamento}
                      onUpdateStatus={onUpdatePagamentoStatus}
                      onDelete={onDeletePagamento}
                    />
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4 border-t border-border/50 px-2">
              <div className="flex-1 text-sm text-muted-foreground">
                Página {currentPage} de {totalPages}
              </div>
              <div className="flex items-center gap-x-2">
                <Button
                  variant="outline"
                  className="size-8 p-0 lg:flex"
                  onClick={() => fetchPagamentos(1, searchPagamento, filterStatus, sortPagamento)}
                  disabled={currentPage === 1 || loadingPagamentos}
                >
                  <span className="sr-only">Primeira página</span>
                  <ChevronsLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  className="size-8 p-0"
                  onClick={() => fetchPagamentos(currentPage - 1, searchPagamento, filterStatus, sortPagamento)}
                  disabled={currentPage === 1 || loadingPagamentos}
                >
                  <span className="sr-only">Página anterior</span>
                  <ChevronLeft className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  className="size-8 p-0"
                  onClick={() => fetchPagamentos(currentPage + 1, searchPagamento, filterStatus, sortPagamento)}
                  disabled={currentPage === totalPages || loadingPagamentos}
                >
                  <span className="sr-only">Próxima página</span>
                  <ChevronRight className="size-4" />
                </Button>
                <Button
                  variant="outline"
                  className="size-8 p-0 lg:flex"
                  onClick={() => fetchPagamentos(totalPages, searchPagamento, filterStatus, sortPagamento)}
                  disabled={currentPage === totalPages || loadingPagamentos}
                >
                  <span className="sr-only">Última página</span>
                  <ChevronsRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </TabsContent>
  )
}
