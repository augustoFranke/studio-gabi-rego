'use client';

import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, Printer, Dumbbell, Calendar, User, Loader2, Save, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import Link from 'next/link';

type Exercise = {
    id: string;
    name: string;
    sets: string;
    reps: string;
};

type Session = {
    id: string;
    name: string;
    exercises: Exercise[];
};

type Treino = {
    id: string;
    nome: string;
    data: string | null;
    objetivo: string | null;
    observacoes: string | null;
    membro: {
        id: string;
        usuario: {
            nome: string;
        };
    };
    exercicios: Array<{
        id: string;
        sessao: string;
        nome: string;
        series: number;
        repeticoes: string;
        carga: string | null;
    }>;
};

interface PageProps {
    params: Promise<{
        id: string;
    }>;
}

export default function EditarTreinoPage({ params }: PageProps) {
    const { id } = use(params);
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [treino, setTreino] = useState<Treino | null>(null);
    const [date, setDate] = useState('');
    const [sessions, setSessions] = useState<Session[]>([]);
    const [exerciseHistory, setExerciseHistory] = useState<string[]>([]);
    const [isSaving, setIsSaving] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);

    // Load training data
    useEffect(() => {
        const fetchTreino = async () => {
            try {
                const response = await fetch(`/api/treinos/${id}`);
                if (response.ok) {
                    const data = await response.json();
                    setTreino(data);
                    setDate(data.data || '');

                    // Convert exercises to sessions format
                    const sessionsMap = new Map<string, Exercise[]>();
                    data.exercicios.forEach((ex: Treino['exercicios'][0]) => {
                        const exercises = sessionsMap.get(ex.sessao) || [];
                        exercises.push({
                            id: ex.id,
                            name: ex.nome,
                            sets: ex.series.toString(),
                            reps: ex.repeticoes,
                        });
                        sessionsMap.set(ex.sessao, exercises);
                    });

                    const loadedSessions: Session[] = Array.from(sessionsMap.entries())
                        .sort(([a], [b]) => a.localeCompare(b))
                        .map(([name, exercises]) => ({
                            id: crypto.randomUUID(),
                            name,
                            exercises,
                        }));

                    if (loadedSessions.length === 0) {
                        loadedSessions.push({ id: crypto.randomUUID(), name: 'A', exercises: [] });
                    }

                    setSessions(loadedSessions);
                } else {
                    toast.error('Treino não encontrado');
                    router.push('/treinos');
                }
            } catch (error) {
                console.error('Error loading training:', error);
                toast.error('Erro ao carregar treino');
                router.push('/treinos');
            } finally {
                setLoading(false);
            }
        };

        fetchTreino();

        // Load exercise history
        const stored = localStorage.getItem('gabi-studio-exercise-history');
        if (stored) {
            try {
                setExerciseHistory(JSON.parse(stored));
            } catch (e) {
                console.error('Failed to parse exercise history', e);
            }
        }
    }, [id, router]);

    const addSession = () => {
        const nextLetter = String.fromCharCode(65 + sessions.length);
        setSessions([
            ...sessions,
            { id: crypto.randomUUID(), name: nextLetter, exercises: [] },
        ]);
    };

    const removeSession = (sessionId: string) => {
        const newSessions = sessions.filter((s) => s.id !== sessionId);
        const reindexed = newSessions.map((s, idx) => ({
            ...s,
            name: String.fromCharCode(65 + idx),
        }));
        setSessions(reindexed);
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

    const handleSave = async () => {
        if (!isValid) return;

        setIsSaving(true);
        saveAllToHistory();

        try {
            const exercicios: Array<{
                sessao: string;
                nome: string;
                series: number;
                repeticoes: string;
            }> = [];

            sessions.forEach(s => {
                s.exercises.forEach((e) => {
                    if (e.name.trim()) {
                        exercicios.push({
                            sessao: s.name,
                            nome: e.name,
                            series: parseInt(e.sets) || 1,
                            repeticoes: e.reps || '10',
                        });
                    }
                });
            });

            const response = await fetch(`/api/treinos/${id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    nome: treino?.nome,
                    data: date,
                    exercicios,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || 'Erro ao salvar treino');
            }

            toast.success('Treino atualizado com sucesso!');
            router.push(`/treinos/${id}`);
        } catch (error) {
            console.error('Error saving training:', error);
            toast.error(error instanceof Error ? error.message : 'Erro ao salvar treino');
        } finally {
            setIsSaving(false);
        }
    };

    const handleGeneratePDF = async () => {
        setIsGenerating(true);
        try {
            window.open(`/api/treinos/${id}/pdf`, '_blank');
            toast.success('PDF gerado!');
        } catch (error) {
            console.error('Error generating PDF:', error);
            toast.error('Erro ao gerar PDF');
        } finally {
            setIsGenerating(false);
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto max-w-5xl py-8 flex items-center justify-center min-h-[400px]">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    if (!treino) {
        return null;
    }

    const hasExercises = sessions.some(s => s.exercises.some(e => e.name.trim()));
    const isValid = date.trim().length > 0 && hasExercises;

    return (
        <div className="container mx-auto max-w-5xl py-8 space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <Link href={`/treinos/${id}`}>
                        <Button variant="ghost" size="icon">
                            <ArrowLeft className="h-5 w-5" />
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">Editar Treino</h1>
                        <p className="text-muted-foreground">Modifique o plano de treino de {treino.membro.usuario.nome}</p>
                    </div>
                </div>

                <div className="flex gap-2">
                    <Button
                        variant="outline"
                        className="gap-2"
                        disabled={isGenerating || isSaving}
                        onClick={handleGeneratePDF}
                    >
                        {isGenerating ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Printer className="h-4 w-4" />
                        )}
                        Imprimir
                    </Button>

                    <Button
                        className="gap-2"
                        disabled={!isValid || isSaving}
                        onClick={handleSave}
                    >
                        {isSaving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="h-4 w-4" />
                        )}
                        {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                </div>
            </div>

            <Separator />

            {/* Header Form - Aluno (read-only) and Date */}
            <Card className="border-primary/20 bg-primary/5">
                <CardContent className="pt-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-2">
                            <Label className="font-medium text-base flex items-center gap-2">
                                <User className="h-4 w-4" />
                                Aluno
                            </Label>
                            <Input
                                value={treino.membro.usuario.nome}
                                disabled
                                className="bg-muted"
                            />
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
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm">
                                    {session.name}
                                </div>
                                Treino {session.name}
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
                                                    type="number"
                                                    placeholder="3"
                                                    className="text-center"
                                                    value={exercise.sets}
                                                    onChange={(e) => updateExercise(session.id, exercise.id, 'sets', e.target.value)}
                                                />
                                            </div>

                                            <div className="col-span-1 md:col-span-2 flex md:block flex-col">
                                                <Label className="md:hidden mb-1.5 block text-xs">Repetições</Label>
                                                <Input
                                                    type="number"
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
