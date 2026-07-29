'use client';

import { useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Plus, Printer, Calendar, User, Loader2, Save, Check, ChevronsUpDown, FileText, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import {
    addExercise as addExerciseEditor,
    addSession as addSessionEditor,
    createEditorSessionsFromExercises,
    type ExerciseField,
    getFullSessionName,
    loadExerciseHistory,
    mergeExerciseHistory,
    removeExercise as removeExerciseEditor,
    reindexSessions as reindexSessionsEditor,
    saveExerciseHistory,
    updateExercise as updateExerciseEditor,
} from '@/lib/treino/editor';
import { formatTreinoDate, isValidTreinoDate } from '@/lib/dates';
import { sortByTextPtBr } from '@/lib/select-options';
import type {
    TreinoEditorSession,
    TreinoTemplate,
} from '@/domain/treino';
import { fetchWithTimeout, LONG_RUNNING_FETCH_TIMEOUT_MS, readResponseErrorMessage } from '@/lib/http';
import { fetcher } from '@/lib/fetcher';
import { SessionCard } from '@/components/treino/session-card';

const EXERCISE_HISTORY_LIST_ID = 'exercises-list';

type Member = {
    id: string;
    usuario: {
        nome: string;
    };
};

function createInitialSessions(): TreinoEditorSession[] {
    return [{ id: crypto.randomUUID(), name: 'A', description: '', exercises: [] }];
}

function loadInitialExerciseHistory(): string[] {
    if (typeof window === 'undefined') {
        return [];
    }

    const { history, stored, parsed } = loadExerciseHistory(localStorage, (error) => {
        console.error('Failed to parse exercise history', error);
    });

    return stored && parsed ? history : [];
}

const subscribeMounted = () => () => {};
const getMountedSnapshot = () => true;
const getServerMountedSnapshot = () => false;

export default function TrainingPlanGeneratorPage() {
    return useTrainingPlanGeneratorPage();
}

function useTrainingPlanGeneratorPage() {
    const { push } = useRouter();
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [memberSelectOpen, setMemberSelectOpen] = useState(false);
    const [templateSelectOpen, setTemplateSelectOpen] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState('');

    const [date, setDate] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [sessions, setSessions] = useState<TreinoEditorSession[]>(createInitialSessions);
    const [exerciseHistory, setExerciseHistory] = useState<string[]>(loadInitialExerciseHistory);
    const mounted = useSyncExternalStore(
        subscribeMounted,
        getMountedSnapshot,
        getServerMountedSnapshot
    );
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const { data: membersData, isLoading: membersLoading } = useSWR<Member[] | { membros?: Member[] }>(
        '/api/membros?status=ATIVO&fields=compact',
        fetcher,
        { revalidateOnFocus: false }
    );
    const { data: templatesData = [], isLoading: templatesLoading } = useSWR<TreinoTemplate[]>(
        '/api/treinos/templates',
        fetcher,
        { revalidateOnFocus: false }
    );
    const memberOptions = useMemo(
        () =>
            sortByTextPtBr(
                Array.isArray(membersData) ? membersData : membersData?.membros || [],
                (member) => member.usuario.nome
            ),
        [membersData]
    );
    const templateOptions = useMemo(
        () => sortByTextPtBr(templatesData, (template) => template.nome),
        [templatesData]
    );

    const selectedMember = memberOptions.find(m => m.id === selectedMemberId);
    const selectedTemplate = templateOptions.find(t => t.id === selectedTemplateId);

    const addSession = useCallback(() => {
        setSessions((prev) => [
            ...prev,
            addSessionEditor(String.fromCharCode(65 + prev.length)), // A, B, C...
        ]);
    }, []);

    const removeSession = useCallback((sessionId: string) => {
        // Re-index names (keep descriptions)
        setSessions((prev) => reindexSessionsEditor(prev.filter((s) => s.id !== sessionId)));
    }, []);

    const updateSessionDescription = useCallback((sessionId: string, description: string) => {
        setSessions((prev) =>
            prev.map((s) => (s.id === sessionId ? { ...s, description } : s))
        );
    }, []);

    const applyTemplate = (template: TreinoTemplate) => {
        setSessions(createEditorSessionsFromExercises(template.exercicios, () => crypto.randomUUID()));
        setObservacoes(template.observacoes || '');
        setSelectedTemplateId(template.id);
        toast.success('Template aplicado!');
    };

    const addExercise = useCallback((sessionId: string) => {
        setSessions((prev) =>
            prev.map((s) =>
                s.id === sessionId
                    ? { ...s, exercises: [...s.exercises, addExerciseEditor()] }
                    : s
            )
        );
    }, []);

    const updateExercise = useCallback((
        sessionId: string,
        exerciseId: string,
        field: ExerciseField,
        value: string
    ) => {
        setSessions((prev) =>
            prev.map((s) =>
                s.id === sessionId
                    ? {
                        ...s,
                        exercises: s.exercises.map((e) =>
                            e.id === exerciseId ? updateExerciseEditor(e, field, value) : e
                        ),
                    }
                    : s
            )
        );
    }, []);

    const removeExercise = useCallback((sessionId: string, exerciseId: string) => {
        setSessions((prev) =>
            prev.map((s) =>
                s.id === sessionId
                    ? { ...s, exercises: removeExerciseEditor(s.exercises, exerciseId) }
                    : s
            )
        );
    }, []);

    // Helper to save all current exercise names to history
    const saveAllToHistory = () => {
        const { history: newHistory, changed } = mergeExerciseHistory(exerciseHistory, sessions);
        if (changed) {
            setExerciseHistory(newHistory);
            saveExerciseHistory(localStorage, newHistory);
        }
    };

    // Get data for API calls
    const getTrainingData = () => {
        const validSessions = sessions.reduce<Array<{ name: string; exercises: Array<{ name: string; sets: string; reps: string; observacoes?: string }> }>>((acc, s) => {
            const exercises = s.exercises.reduce<Array<{ name: string; sets: string; reps: string; observacoes?: string }>>((exerciseAcc, e) => {
                if (!e.name.trim()) {
                    return exerciseAcc;
                }

                exerciseAcc.push({
                    name: e.name,
                    sets: e.sets,
                    reps: e.reps,
                    observacoes: e.notes.trim() || undefined,
                });

                return exerciseAcc;
            }, []);

            if (exercises.length > 0) {
                acc.push({
                    name: getFullSessionName(s),
                    exercises,
                });
            }

            return acc;
        }, []);

        return {
            aluno: selectedMember?.usuario.nome || '',
            date,
            observacoes: observacoes.trim() || undefined,
            sessions: validSessions,
        };
    };

    // Generate PDF using Python backend
    const handleGeneratePDF = async () => {
        if (!isValid) return;

        setIsGenerating(true);
        saveAllToHistory();

        try {
            const data = getTrainingData();
            const response = await fetchWithTimeout('/api/treinos/gerar-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                timeoutMs: LONG_RUNNING_FETCH_TIMEOUT_MS,
            });

            if (!response.ok) {
                throw new Error(await readResponseErrorMessage(response, 'Erro ao gerar PDF'));
            }

            // Download the PDF
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Treino-${data.aluno.replace(/[^a-zA-Z0-9]/g, '-')}-${date.replace(/\//g, '-')}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            toast.success('PDF gerado com sucesso!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error(error instanceof Error ? error.message : 'Erro ao gerar PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    // Save and generate PDF
    const handleSaveAndPrint = async () => {
        if (!isValid) return;

        setIsSaving(true);
        saveAllToHistory();

        try {
            // First save to database
            const exercicios: Array<{
                sessao: string;
                nome: string;
                series: string;
                repeticoes: string;
                observacoes?: string;
            }> = [];

            sessions.forEach(s => {
                const fullSessionName = getFullSessionName(s);
                s.exercises.forEach((e) => {
                    if (e.name.trim()) {
                        exercicios.push({
                            sessao: fullSessionName,
                            nome: e.name,
                            series: e.sets || '3',
                            repeticoes: e.reps || '10',
                            observacoes: e.notes.trim() || undefined,
                        });
                    }
                });
            });

            const saveResponse = await fetchWithTimeout('/api/treinos', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    membroId: selectedMemberId,
                    nome: `Treino ${date}`,
                    data: date,
                    observacoes: observacoes.trim() || undefined,
                    exercicios,
                }),
            });

            if (!saveResponse.ok) {
                throw new Error(await readResponseErrorMessage(saveResponse, 'Erro ao salvar treino'));
            }

            toast.success('Treino salvo!');

            // Then generate PDF
            const data = getTrainingData();
            const pdfResponse = await fetchWithTimeout('/api/treinos/gerar-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
                timeoutMs: LONG_RUNNING_FETCH_TIMEOUT_MS,
            });

            if (pdfResponse.ok) {
                const blob = await pdfResponse.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `Treino-${data.aluno.replace(/[^a-zA-Z0-9]/g, '-')}-${date.replace(/\//g, '-')}.pdf`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                toast.success('PDF gerado!');
            }

            push('/treinos');
        } catch (error) {
            console.error('Error:', error);
            toast.error(error instanceof Error ? error.message : 'Erro ao processar');
        } finally {
            setIsSaving(false);
        }
    };

    if (!mounted) return null;

    const hasExercises = sessions.some(s => s.exercises.some(e => e.name.trim()));
    const isValidDate = isValidTreinoDate(date);
    const isValid = selectedMemberId && isValidDate && hasExercises;

    return (
        <div className="container mx-auto max-w-5xl py-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Novo Treino</h1>
                    <p className="text-muted-foreground">Crie um plano de treino personalizado para o aluno.</p>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="gap-2"
                        disabled={!isValid || isGenerating || isSaving}
                        onClick={handleGeneratePDF}
                    >
                        {isGenerating ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Printer className="size-4" />
                        )}
                        Apenas PDF
                    </Button>

                    <Button
                        className="gap-2"
                        disabled={!isValid || isGenerating || isSaving}
                        onClick={handleSaveAndPrint}
                    >
                        {isSaving ? (
                            <Loader2 className="size-4 animate-spin" />
                        ) : (
                            <Save className="size-4" />
                        )}
                        {isSaving ? 'Salvando…' : 'Salvar e Imprimir'}
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Header Form - Aluno and Date */}
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                    <div className="space-y-2">
                        <Label className="font-medium text-base flex items-center gap-2">
                            <Bookmark className="size-4" />
                            Template
                        </Label>
                        <Popover open={templateSelectOpen} onOpenChange={setTemplateSelectOpen}>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={templateSelectOpen}
                                    aria-controls="template-select-list"
                                    className="w-full justify-between bg-background"
                                    disabled={templatesLoading || templateOptions.length === 0}
                                >
                                    {templatesLoading ? (
                                        <span className="text-muted-foreground">Carregando…</span>
                                    ) : selectedTemplate ? (
                                        selectedTemplate.nome
                                    ) : templateOptions.length === 0 ? (
                                        <span className="text-muted-foreground">Nenhum template cadastrado</span>
                                    ) : (
                                        <span className="text-muted-foreground">Selecione um template…</span>
                                    )}
                                    <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-full p-0" align="start">
                                <Command>
                                    <CommandInput placeholder="Buscar template..." />
                                    <CommandList id="template-select-list">
                                        <CommandEmpty>Nenhum template encontrado.</CommandEmpty>
                                        <CommandGroup>
                                            {templateOptions.map((template) => (
                                                <CommandItem
                                                    key={template.id}
                                                    value={template.nome}
                                                    onSelect={() => {
                                                        applyTemplate(template);
                                                        setTemplateSelectOpen(false);
                                                    }}
                                                >
                                                    <Check
                                                        className={cn(
                                                            "mr-2 size-4",
                                                            selectedTemplateId === template.id ? "opacity-100" : "opacity-0"
                                                        )}
                                                    />
                                                    {template.nome}
                                                </CommandItem>
                                            ))}
                                        </CommandGroup>
                                    </CommandList>
                                </Command>
                            </PopoverContent>
                        </Popover>
                        <p className="text-xs text-muted-foreground">
                            Aplicar um template substitui as sessões atuais.
                        </p>
                    </div>

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-medium text-base flex items-center gap-2">
                                <User className="size-4" />
                                Aluno
                            </Label>
                            <Popover open={memberSelectOpen} onOpenChange={setMemberSelectOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={memberSelectOpen}
                                        aria-controls="member-select-list"
                                        className="w-full justify-between bg-background"
                                        disabled={membersLoading}
                                    >
                                        {membersLoading ? (
                                            <span className="text-muted-foreground">Carregando…</span>
                                        ) : selectedMember ? (
                                            selectedMember.usuario.nome
                                        ) : (
                                            <span className="text-muted-foreground">Selecione o aluno…</span>
                                        )}
                                        <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Buscar aluno..." />
                                        <CommandList id="member-select-list">
                                            <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                                            <CommandGroup>
                                                {memberOptions.map((member) => (
                                                    <CommandItem
                                                        key={member.id}
                                                        value={member.usuario.nome}
                                                        onSelect={() => {
                                                            setSelectedMemberId(member.id);
                                                            setMemberSelectOpen(false);
                                                        }}
                                                    >
                                                        <Check
                                                            className={cn(
                                                                "mr-2 size-4",
                                                                selectedMemberId === member.id ? "opacity-100" : "opacity-0"
                                                            )}
                                                        />
                                                        {member.usuario.nome}
                                                    </CommandItem>
                                                ))}
                                            </CommandGroup>
                                        </CommandList>
                                    </Command>
                                </PopoverContent>
                            </Popover>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="date" className="font-medium text-base flex items-center gap-2">
                                <Calendar className="size-4" />
                                Data
                            </Label>
                            <Input
                                id="date"
                                placeholder="MM/AAAA"
                                value={date}
                                onChange={(e) => setDate(formatTreinoDate(e.target.value))}
                                className={cn(
                                    "bg-background",
                                    date && !isValidDate && "border-destructive focus-visible:ring-destructive"
                                )}
                                maxLength={7}
                            />
                            {date && !isValidDate && (
                                <p className="text-xs text-destructive mt-1">
                                    Formato inválido. Use MM/AAAA (ex: 01/2025)
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="mt-6 space-y-2">
                        <Label htmlFor="observacoes" className="font-medium text-base flex items-center gap-2">
                            <FileText className="size-4" />
                            Observações
                        </Label>
                        <Textarea
                            id="observacoes"
                            placeholder="Observações gerais sobre o treino..."
                            value={observacoes}
                            onChange={(e) => setObservacoes(e.target.value)}
                            className="bg-background min-h-[80px]"
                        />
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 gap-6">
                {sessions.map((session) => (
                    <SessionCard
                        key={session.id}
                        session={session}
                        exerciseHistoryListId={EXERCISE_HISTORY_LIST_ID}
                        onDescriptionChange={updateSessionDescription}
                        onRemoveSession={removeSession}
                        onAddExercise={addExercise}
                        onExerciseChange={updateExercise}
                        onRemoveExercise={removeExercise}
                    />
                ))}

                <Button
                    size="lg"
                    variant="secondary"
                    className="w-full py-8 text-lg font-medium border-2 border-dashed"
                    onClick={addSession}
                >
                    <Plus className="mr-2 size-6" />
                    Adicionar Novo Treino
                </Button>
            </div>

            {/* Datalist for Autocomplete */}
            <datalist id={EXERCISE_HISTORY_LIST_ID}>
                {exerciseHistory.map((name) => (
                    <option key={name} value={name}>{name}</option>
                ))}
            </datalist>
        </div>
    );
}
