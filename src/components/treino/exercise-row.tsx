'use client';

import { memo, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ExerciseField } from '@/lib/treino/editor';
import type { TreinoEditorExercise } from '@/domain/treino';

export interface ExerciseRowProps {
    sessionId: string;
    exercise: TreinoEditorExercise;
    exerciseHistoryListId: string;
    onChange: (sessionId: string, exerciseId: string, field: ExerciseField, value: string) => void;
    onRemove: (sessionId: string, exerciseId: string) => void;
}

function ExerciseRowComponent({
    sessionId,
    exercise,
    exerciseHistoryListId,
    onChange,
    onRemove,
}: ExerciseRowProps) {
    const handleFieldChange = useCallback(
        (field: ExerciseField) => (event: React.ChangeEvent<HTMLInputElement>) => {
            onChange(sessionId, exercise.id, field, event.target.value);
        },
        [onChange, sessionId, exercise.id]
    );

    const handleRemove = useCallback(() => {
        onRemove(sessionId, exercise.id);
    }, [onRemove, sessionId, exercise.id]);

    const nameId = `${exercise.id}-name`;
    const setsId = `${exercise.id}-sets`;
    const repsId = `${exercise.id}-reps`;
    const notesId = `${exercise.id}-notes`;

    return (
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end md:items-center bg-card md:bg-transparent p-3 md:p-0 rounded-lg border md:border-0 shadow-sm md:shadow-none">
            <div className="col-span-1 md:col-span-6 w-full">
                <Label htmlFor={nameId} className="md:sr-only mb-1.5 block text-xs">
                    Exercício
                </Label>
                <Input
                    id={nameId}
                    placeholder="Nome do exercício..."
                    value={exercise.name}
                    onChange={handleFieldChange('name')}
                    list={exerciseHistoryListId}
                    autoComplete="off"
                />
            </div>

            <div className="col-span-1 md:col-span-2 flex md:block flex-col">
                <Label htmlFor={setsId} className="md:sr-only mb-1.5 block text-xs">
                    Séries
                </Label>
                <Input
                    id={setsId}
                    type="text"
                    inputMode="numeric"
                    placeholder="3"
                    className="text-center"
                    value={exercise.sets}
                    onChange={handleFieldChange('sets')}
                />
            </div>

            <div className="col-span-1 md:col-span-2 flex md:block flex-col">
                <Label htmlFor={repsId} className="md:sr-only mb-1.5 block text-xs">
                    Repetições
                </Label>
                <Input
                    id={repsId}
                    type="text"
                    inputMode="numeric"
                    placeholder="10"
                    className="text-center"
                    value={exercise.reps}
                    onChange={handleFieldChange('reps')}
                />
            </div>

            <div className="col-span-1 md:col-span-2 flex justify-end md:justify-center">
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive size-9"
                    onClick={handleRemove}
                    aria-label="Remover exercício"
                    title="Remover exercício"
                >
                    <Trash2 className="size-4" />
                </Button>
            </div>

            <div className="col-span-1 md:col-span-12 w-full">
                <Label htmlFor={notesId} className="mb-1.5 block text-xs text-muted-foreground">
                    Observações
                </Label>
                <Input
                    id={notesId}
                    placeholder="Observações específicas deste exercício..."
                    value={exercise.notes}
                    onChange={handleFieldChange('notes')}
                />
            </div>
        </div>
    );
}

export const ExerciseRow = memo(ExerciseRowComponent);
