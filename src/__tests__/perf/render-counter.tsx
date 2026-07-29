import { memo, type ComponentType } from 'react'

export interface RenderCounter {
  total: () => number
  forKey: (key: string) => number
  reset: () => void
}

/**
 * Wraps a component in `memo` and tallies how often it actually renders.
 * The memo wrapper sits between the parent and the real component, so the tally
 * reflects whether the parent passes referentially stable props.
 */
export function countRenders<P extends object>(
  Component: ComponentType<P>,
  keyOf: (props: P) => string = () => 'default'
): [ComponentType<P>, RenderCounter] {
  const counts = new Map<string, number>()

  const Counted = memo(function Counted(props: P) {
    const key = keyOf(props)
    counts.set(key, (counts.get(key) ?? 0) + 1)
    return <Component {...props} />
  }) as ComponentType<P>

  return [
    Counted,
    {
      total: () => [...counts.values()].reduce((sum, n) => sum + n, 0),
      forKey: (key) => counts.get(key) ?? 0,
      reset: () => counts.clear(),
    },
  ]
}
