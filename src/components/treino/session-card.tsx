'use client';

import { memo, useCallback } from 'react';
import { Dumbbell, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ExerciseRow } from './exercise-row';
import type { ExerciseField } from '@/lib/treino/editor';
import type { TreinoEditorSession } from '@/domain/treino';

export interface SessionCardProps {
    session: TreinoEditorSession;
    exerciseHistoryListId: string;
    onDescriptionChange: (sessionId: string, description: string) => void;
    onRemoveSession: (sessionId: string) => void;
    onAddExercise: (sessionId: string) => void;
    onExerciseChange: (
        sessionId: string,
        exerciseId: string,
        field: ExerciseField,
        value: string
    ) => void;
    onRemoveExercise: (sessionId: string, exerciseId: string) => void;
}

function SessionCardComponent({
    session,
    exerciseHistoryListId,
    onDescriptionChange,
    onRemoveSession,
    onAddExercise,
    onExerciseChange,
    onRemoveExercise,
}: SessionCardProps) {
    const handleDescriptionChange = useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            onDescriptionChange(session.id, event.target.value);
        },
        [onDescriptionChange, session.id]
    );

    const handleRemoveSession = useCallback(() => {
        onRemoveSession(session.id);
    }, [onRemoveSession, session.id]);

    const handleAddExercise = useCallback(() => {
        onAddExercise(session.id);
    }, [onAddExercise, session.id]);

    return (
        <Card className="overflow-hidden shadow-[inset_4px_0_0_var(--primary)]">
            <CardHeader className="bg-muted/30 pb-4">
                <CardTitle className="flex flex-wrap items-center gap-2 text-xl">
                    <div
                        aria-hidden="true"
                        className="flex items-center justify-center size-8 rounded-full bg-primary text-primary-foreground text-sm font-bold"
                    >
                        {session.name}
                    </div>
                    <span className="whitespace-nowrap">Treino {session.name}</span>
                    <span aria-hidden="true" className="text-muted-foreground font-normal">
                        -
                    </span>
                    <Input
                        aria-label={`Descrição do treino ${session.name}`}
                        placeholder="Ex: Costas e Bíceps"
                        value={session.description}
                        onChange={handleDescriptionChange}
                        className="flex-1 h-8 text-base font-normal bg-background max-w-xs"
                    />
                </CardTitle>
                <CardAction>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="text-muted-foreground hover:text-destructive"
                        onClick={handleRemoveSession}
                        aria-label={`Remover treino ${session.name}`}
                        title="Remover Treino"
                    >
                        <Trash2 className="size-4" />
                    </Button>
                </CardAction>
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
                            <ExerciseRow
                                key={exercise.id}
                                sessionId={session.id}
                                exercise={exercise}
                                exerciseHistoryListId={exerciseHistoryListId}
                                onChange={onExerciseChange}
                                onRemove={onRemoveExercise}
                            />
                        ))}
                    </div>
                )}

                <Button variant="outline" className="w-full border-dashed" onClick={handleAddExercise}>
                    <Plus className="mr-2 size-4" />
                    Adicionar Exercício
                </Button>
            </CardContent>
        </Card>
    );
}

export const SessionCard = memo(SessionCardComponent);
