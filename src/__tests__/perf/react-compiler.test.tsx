// @vitest-environment jsdom

import { describe, expect, it } from 'vitest'
import { SessionCard } from '@/components/treino/session-card'
import { ExerciseRow } from '@/components/treino/exercise-row'
import { WeeklyView } from '@/components/schedule/weekly-view'
import { DailyView } from '@/components/schedule/daily-view'
import { TimeSlot } from '@/components/schedule/time-slot'
import { MemberBadge } from '@/components/schedule/member-badge'
import { PagamentoRow } from '@/app/(admin)/financeiro/_components/pagamento-row'

/**
 * Guards the premise of the render-count tests in this directory: they only
 * describe production behaviour while the test pipeline applies the same
 * babel-plugin-react-compiler that next.config.ts `reactCompiler` turns on.
 *
 * The compiler silently skips whole functions it cannot lower — notably any
 * component using destructuring defaults (`isEditable = false`) or `try/finally`
 * — so "the build succeeded" says nothing about a given component. Compiled
 * output allocates a memo cache and reads it through `$[i]`; its absence here
 * means that component ships unmemoized by the compiler.
 */
function compiledSource(component: unknown): string {
  return String((component as { type: unknown }).type)
}

describe('react compiler', () => {
  it.each([
    ['SessionCard', SessionCard],
    ['ExerciseRow', ExerciseRow],
    ['WeeklyView', WeeklyView],
    ['DailyView', DailyView],
    ['TimeSlot', TimeSlot],
    ['MemberBadge', MemberBadge],
    ['PagamentoRow', PagamentoRow],
  ])('compiles %s with a memo cache', (_name, component) => {
    expect(compiledSource(component)).toMatch(/\$\[\d+\]/)
  })
})
