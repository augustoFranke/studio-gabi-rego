'use client';

import { useState, useEffect, useSyncExternalStore } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import { Plus, Trash2, Printer, Dumbbell, Calendar, User, Loader2, Save, Check, ChevronsUpDown, FileText, Bookmark } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    const memberOptions = sortByTextPtBr(
        Array.isArray(membersData) ? membersData : membersData?.membros || [],
        (member) => member.usuario.nome
    );
    const templateOptions = sortByTextPtBr(templatesData, (template) => template.nome);

    const selectedMember = memberOptions.find(m => m.id === selectedMemberId);
    const selectedTemplate = templateOptions.find(t => t.id === selectedTemplateId);

    const addSession = () => {
        const nextLetter = String.fromCharCode(65 + sessions.length); // A, B, C...
        setSessions([
            ...sessions,
            addSessionEditor(nextLetter),
        ]);
    };

    const removeSession = (sessionId: string) => {
        const newSessions = sessions.filter((s) => s.id !== sessionId);
        // Re-index names (keep descriptions)
        const reindexed = reindexSessionsEditor(newSessions);
        setSessions(reindexed);
    };

    const updateSessionDescription = (sessionId: string, description: string) => {
        setSessions(
            sessions.map((s) => {
                if (s.id === sessionId) {
                    return { ...s, description };
                }
                return s;
            })
        );
    };

    const applyTemplate = (template: TreinoTemplate) => {
        setSessions(createEditorSessionsFromExercises(template.exercicios, () => crypto.randomUUID()));
        setObservacoes(template.observacoes || '');
        setSelectedTemplateId(template.id);
        toast.success('Template aplicado!');
    };

    const addExercise = (sessionId: string) => {
        setSessions(
            sessions.map((s) => {
                if (s.id === sessionId) {
                    return {
                        ...s,
                        exercises: [
                            ...s.exercises,
                            addExerciseEditor(),
                        ],
                    };
                }
                return s;
            })
        );
    };

    const updateExercise = (
        sessionId: string,
        exerciseId: string,
        field: ExerciseField,
        value: string
    ) => {
        setSessions(
            sessions.map((s) => {
                if (s.id === sessionId) {
                    return {
                        ...s,
                        exercises: s.exercises.map((e) => {
                            if (e.id === exerciseId) {
                                return updateExerciseEditor(e, field, value);
                            }
                            return e;
                        }),
                    };
                }
                return s;
            })
        );
    };

    const removeExercise = (sessionId: string, exerciseId: string) => {
        setSessions(
            sessions.map((s) => {
                if (s.id === sessionId) {
                    return {
                        ...s,
                        exercises: removeExerciseEditor(s.exercises, exerciseId),
                    };
                }
                return s;
            })
        );
    };

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
        const validSessions = sessions.reduce<Array<{ name: string; exercises: Array<{ name: string; sets: string; reps: string }> }>>((acc, s) => {
            const exercises = s.exercises.reduce<Array<{ name: string; sets: string; reps: string }>>((exerciseAcc, e) => {
                if (!e.name.trim()) {
                    return exerciseAcc;
                }

                exerciseAcc.push({
                    name: e.name,
                    sets: e.sets,
                    reps: e.reps,
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
                    <Card key={session.id} className="relative overflow-hidden shadow-[inset_4px_0_0_hsl(var(--primary))]">
                        <div className="absolute top-0 right-0 p-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => removeSession(session.id)}
                                title="Remover Treino"
                            >
                                <Trash2 className="size-4" />
                            </Button>
                        </div>

                        <CardHeader className="bg-muted/30 pb-4">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <div className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                                    {session.name}
                                </div>
                                <span className="whitespace-nowrap">Treino {session.name}</span>
                                <span className="text-muted-foreground font-normal">-</span>
                                <Input
                                    placeholder="Ex: Costas e Bíceps"
                                    value={session.description}
                                    onChange={(e) => updateSessionDescription(session.id, e.target.value)}
                                    className="flex-1 h-8 text-base font-normal bg-background max-w-xs"
                                />
                            </CardTitle>
                        </CardHeader>

                        <CardContent className="pt-6 space-y-4">
                            {session.exercises.length === 0 ? (
                                <div className="text-center py-6 text-muted-foreground border-2 border-dashed rounded-lg">
                                    <Dumbbell className="mx-auto size-8 mb-2 opacity-50" />
                                    <p>Nenhum exercício adicionado ainda.</p>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {/* Headers for larger screens */}
                                    <div className="hidden md:grid grid-cols-12 gap-4 px-1 text-sm font-medium text-muted-foreground">
                                        <div className="col-span-6">Exercício</div>
                                        <div className="col-span-2 text-center">Séries</div>
                                        <div className="col-span-2 text-center">Repetições</div>
                                        <div className="col-span-2"></div>
                                    </div>

                                    {session.exercises.map((exercise) => (
                                        <div key={exercise.id} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end md:items-center bg-card md:bg-transparent p-3 md:p-0 rounded-lg border md:border-0 shadow-sm md:shadow-none">

                                            <div className="col-span-1 md:col-span-6 w-full">
                                                <Label className="md:hidden mb-1.5 block text-xs">Exercício</Label>
                                                <Input
                                                    placeholder="Nome do exercício..."
                                                    value={exercise.name}
                                                    onChange={(e) => updateExercise(session.id, exercise.id, 'name', e.target.value)}
                                                    list="exercises-list"
                                                    autoComplete="off"
                                                />
                                            </div>

                                            <div className="col-span-1 md:col-span-2 flex md:block flex-col">
                                                <Label className="md:hidden mb-1.5 block text-xs">Séries</Label>
                                                <Input
                                                    type="text"
                                                    placeholder="3"
                                                    className="text-center"
                                                    value={exercise.sets}
                                                    onChange={(e) => updateExercise(session.id, exercise.id, 'sets', e.target.value)}
                                                />
                                            </div>

                                            <div className="col-span-1 md:col-span-2 flex md:block flex-col">
                                                <Label className="md:hidden mb-1.5 block text-xs">Repetições</Label>
                                                <Input
                                                    type="text"
                                                    placeholder="10"
                                                    className="text-center"
                                                    value={exercise.reps}
                                                    onChange={(e) => updateExercise(session.id, exercise.id, 'reps', e.target.value)}
                                                />
                                            </div>

                                            <div className="col-span-1 md:col-span-2 flex justify-end md:justify-center">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-muted-foreground hover:text-destructive size-9"
                                                    onClick={() => removeExercise(session.id, exercise.id)}
                                                >
                                                    <Trash2 className="size-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <Button
                                variant="outline"
                                className="w-full border-dashed"
                                onClick={() => addExercise(session.id)}
                            >
                                <Plus className="mr-2 size-4" />
                                Adicionar Exercício
                            </Button>
                        </CardContent>
                    </Card>
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
            <datalist id="exercises-list">
                {exerciseHistory.map((name) => (
                    <option key={name} value={name}>{name}</option>
                ))}
            </datalist>
        </div>
    );
}
