'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Printer, Dumbbell, Calendar, User, Loader2, Save, Check, ChevronsUpDown, FileText } from 'lucide-react';
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

type Exercise = {
    id: string;
    name: string;
    sets: string;
    reps: string;
};

type Session = {
    id: string;
    name: string;
    description: string;
    exercises: Exercise[];
};

type Member = {
    id: string;
    usuario: {
        nome: string;
    };
};

export default function TrainingPlanGeneratorPage() {
    const router = useRouter();
    const [selectedMemberId, setSelectedMemberId] = useState('');
    const [members, setMembers] = useState<Member[]>([]);
    const [membersLoading, setMembersLoading] = useState(true);
    const [memberSelectOpen, setMemberSelectOpen] = useState(false);

    const [date, setDate] = useState('');
    const [observacoes, setObservacoes] = useState('');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [exerciseHistory, setExerciseHistory] = useState<string[]>([]);
    const [mounted, setMounted] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isSaving, setIsSaving] = useState(false);

    // Load members
    useEffect(() => {
        const fetchMembers = async () => {
            try {
                const response = await fetch('/api/membros?status=ATIVO');
                if (response.ok) {
                    const data = await response.json();
                    setMembers(data.membros || data);
                }
            } catch (error) {
                console.error('Error loading members:', error);
            } finally {
                setMembersLoading(false);
            }
        };
        fetchMembers();
    }, []);

    // Initialize
    useEffect(() => {
        setMounted(true);
        // Load history
        const stored = localStorage.getItem('gabi-studio-exercise-history');
        if (stored) {
            try {
                setExerciseHistory(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse exercise history', e);
            }
        }

        // Initial session
        setSessions([
            { id: crypto.randomUUID(), name: 'A', description: '', exercises: [] }
        ]);
    }, []);

    const selectedMember = members.find(m => m.id === selectedMemberId);

    const addSession = () => {
        const nextLetter = String.fromCharCode(65 + sessions.length); // A, B, C...
        setSessions([
            ...sessions,
            { id: crypto.randomUUID(), name: nextLetter, description: '', exercises: [] },
        ]);
    };

    const removeSession = (sessionId: string) => {
        const newSessions = sessions.filter((s) => s.id !== sessionId);
        // Re-index names (keep descriptions)
        const reindexed = newSessions.map((s, idx) => ({
            ...s,
            name: String.fromCharCode(65 + idx),
        }));
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

    const addExercise = (sessionId: string) => {
        setSessions(
            sessions.map((s) => {
                if (s.id === sessionId) {
                    return {
                        ...s,
                        exercises: [
                            ...s.exercises,
                            { id: crypto.randomUUID(), name: '', sets: '', reps: '' },
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
        field: keyof Exercise,
        value: string
    ) => {
        setSessions(
            sessions.map((s) => {
                if (s.id === sessionId) {
                    return {
                        ...s,
                        exercises: s.exercises.map((e) => {
                            if (e.id === exerciseId) {
                                return { ...e, [field]: value };
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
                        exercises: s.exercises.filter((e) => e.id !== exerciseId),
                    };
                }
                return s;
            })
        );
    };

    // Helper to save all current exercise names to history
    const saveAllToHistory = () => {
        const newHistory = [...exerciseHistory];
        let changed = false;
        sessions.forEach(s => {
            s.exercises.forEach(e => {
                const trimmed = e.name.trim();
                if (trimmed && !newHistory.includes(trimmed)) {
                    newHistory.push(trimmed);
                    changed = true;
                }
            });
        });

        if (changed) {
            newHistory.sort();
            setExerciseHistory(newHistory);
            localStorage.setItem('gabi-studio-exercise-history', JSON.stringify(newHistory));
        }
    };

    // Get full session name combining letter and description
    const getFullSessionName = (session: Session) => {
        return session.description.trim()
            ? `${session.name} - ${session.description.trim()}`
            : session.name;
    };

    // Get data for API calls
    const getTrainingData = () => {
        const validSessions = sessions
            .map(s => ({
                name: getFullSessionName(s),
                exercises: s.exercises.filter(e => e.name.trim()).map(e => ({
                    name: e.name,
                    sets: e.sets,
                    reps: e.reps,
                })),
            }))
            .filter(s => s.exercises.length > 0);

        return {
            aluno: selectedMember?.usuario.nome || '',
            date,
            observacoes: observacoes.trim() || undefined,
            sessions: validSessions,
        };
    };

    // Save to database
    const handleSave = async () => {
        if (!isValid) return;

        setIsSaving(true);
        saveAllToHistory();

        try {
            // Build exercises array with sessions
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

            const response = await fetch('/api/treinos', {
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

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao salvar treino');
            }

            toast.success('Treino salvo com sucesso!');
            router.push('/treinos');
        } catch (error) {
            console.error('Error saving training:', error);
            toast.error(error instanceof Error ? error.message : 'Erro ao salvar treino');
        } finally {
            setIsSaving(false);
        }
    };

    // Generate PDF using Python backend
    const handleGeneratePDF = async () => {
        if (!isValid) return;

        setIsGenerating(true);
        saveAllToHistory();

        try {
            const data = getTrainingData();
            const response = await fetch('/api/treinos/gerar-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao gerar PDF');
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

            const saveResponse = await fetch('/api/treinos', {
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
                const errorData = await saveResponse.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao salvar treino');
            }

            toast.success('Treino salvo!');

            // Then generate PDF
            const data = getTrainingData();
            const pdfResponse = await fetch('/api/treinos/gerar-pdf', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
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

            router.push('/treinos');
        } catch (error) {
            console.error('Error:', error);
            toast.error(error instanceof Error ? error.message : 'Erro ao processar');
        } finally {
            setIsSaving(false);
        }
    };

    if (!mounted) return null;

    const hasExercises = sessions.some(s => s.exercises.some(e => e.name.trim()));
    const isValid = selectedMemberId && date.trim().length > 0 && hasExercises;

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
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Printer className="h-4 w-4" />
                        )}
                        Apenas PDF
                    </Button>

                    <Button
                        className="gap-2"
                        disabled={!isValid || isGenerating || isSaving}
                        onClick={handleSaveAndPrint}
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {isSaving ? 'Salvando...' : 'Salvar e Imprimir'}
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Header Form - Aluno and Date */}
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-medium text-base flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Aluno
                            </Label>
                            <Popover open={memberSelectOpen} onOpenChange={setMemberSelectOpen}>
                                <PopoverTrigger asChild>
                                    <Button
                                        variant="outline"
                                        role="combobox"
                                        aria-expanded={memberSelectOpen}
                                        className="w-full justify-between bg-background"
                                        disabled={membersLoading}
                                    >
                                        {membersLoading ? (
                                            <span className="text-muted-foreground">Carregando...</span>
                                        ) : selectedMember ? (
                                            selectedMember.usuario.nome
                                        ) : (
                                            <span className="text-muted-foreground">Selecione o aluno...</span>
                                        )}
                                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                    </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0" align="start">
                                    <Command>
                                        <CommandInput placeholder="Buscar aluno..." />
                                        <CommandList>
                                            <CommandEmpty>Nenhum aluno encontrado.</CommandEmpty>
                                            <CommandGroup>
                                                {members.map((member) => (
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
                                                                "mr-2 h-4 w-4",
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
                                <Calendar className="h-4 w-4" />
                                Data
                            </Label>
                            <Input
                                id="date"
                                placeholder="MM/AAAA"
                                value={date}
                                onChange={(e) => setDate(e.target.value)}
                                className="bg-background"
                            />
                        </div>
                    </div>
                    <div className="mt-6 space-y-2">
                        <Label htmlFor="observacoes" className="font-medium text-base flex items-center gap-2">
                            <FileText className="h-4 w-4" />
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
                    <Card key={session.id} className="relative overflow-hidden border-l-4 border-l-primary">
                        <div className="absolute top-0 right-0 p-4">
                            <Button
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground hover:text-destructive"
                                onClick={() => removeSession(session.id)}
                                title="Remover Treino"
                            >
                                <Trash2 className="h-4 w-4" />
                            </Button>
                        </div>

                        <CardHeader className="bg-muted/30 pb-4">
                            <CardTitle className="flex items-center gap-2 text-xl">
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
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
                                    <Dumbbell className="mx-auto h-8 w-8 mb-2 opacity-50" />
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
                                                    className="text-muted-foreground hover:text-destructive h-9 w-9"
                                                    onClick={() => removeExercise(session.id, exercise.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
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
                                <Plus className="mr-2 h-4 w-4" />
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
                    <Plus className="mr-2 h-6 w-6" />
                    Adicionar Novo Treino
                </Button>
            </div>

            {/* Datalist for Autocomplete */}
            <datalist id="exercises-list">
                {exerciseHistory.map((name, i) => (
                    <option key={i} value={name} />
                ))}
            </datalist>
        </div>
    );
}
