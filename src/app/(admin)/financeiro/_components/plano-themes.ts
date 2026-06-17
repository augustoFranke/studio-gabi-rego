export type PlanoCategoryKey = 'gabi' | 'estagiarios' | 'outros'

export type PlanoGroupKey = 'planosGabi' | 'planosEstagiarios' | 'planosOutros'

export type PlanoTheme = {
  key: PlanoCategoryKey
  groupKey: PlanoGroupKey
  iconLetter: string
  title: string
  subtitle: string
  iconGradient: string
  badgeGradient: string
  cardBorderBg: string
  titleColor: string
  valueColor: string
  iconColor: string
  buttonHover: string
}

export const PLAN_THEMES: PlanoTheme[] = [
  {
    key: 'gabi',
    groupKey: 'planosGabi',
    iconLetter: 'G',
    title: 'Planos com Gabi',
    subtitle: 'Atendimento personalizado pela Gabi',
    iconGradient: 'bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center shadow-md shadow-amber-500/30',
    badgeGradient: 'bg-gradient-to-r from-amber-400 to-orange-500 text-white border-0 ml-auto',
    cardBorderBg: 'border-amber-200 bg-gradient-to-br from-amber-50/50 to-orange-50/30 dark:from-amber-950/20 dark:to-orange-950/10 dark:border-amber-800/30 hover:shadow-lg hover:shadow-amber-500/10 transition-shadow',
    titleColor: 'text-amber-900 dark:text-amber-100',
    valueColor: 'text-amber-600 dark:text-amber-400',
    iconColor: 'text-amber-500',
    buttonHover: 'hover:bg-amber-100 hover:text-amber-700 hover:border-amber-300 dark:hover:bg-amber-950/50',
  },
  {
    key: 'estagiarios',
    groupKey: 'planosEstagiarios',
    iconLetter: 'E',
    title: 'Planos com Estagiários',
    subtitle: 'Atendimento pela equipe de estagiários',
    iconGradient: 'bg-gradient-to-br from-sky-400 to-blue-500 flex items-center justify-center shadow-md shadow-blue-500/30',
    badgeGradient: 'bg-gradient-to-r from-sky-400 to-blue-500 text-white border-0 ml-auto',
    cardBorderBg: 'border-sky-200 bg-gradient-to-br from-sky-50/50 to-blue-50/30 dark:from-sky-950/20 dark:to-blue-950/10 dark:border-sky-800/30 hover:shadow-lg hover:shadow-blue-500/10 transition-shadow',
    titleColor: 'text-sky-900 dark:text-sky-100',
    valueColor: 'text-sky-600 dark:text-sky-400',
    iconColor: 'text-sky-500',
    buttonHover: 'hover:bg-sky-100 hover:text-sky-700 hover:border-sky-300 dark:hover:bg-sky-950/50',
  },
  {
    key: 'outros',
    groupKey: 'planosOutros',
    iconLetter: '+',
    title: 'Outros Planos',
    subtitle: 'Planos especiais e personalizados',
    iconGradient: 'bg-gradient-to-br from-violet-400 to-purple-500 flex items-center justify-center shadow-md shadow-purple-500/30',
    badgeGradient: 'bg-gradient-to-r from-violet-400 to-purple-500 text-white border-0 ml-auto',
    cardBorderBg: 'border-violet-200 bg-gradient-to-br from-violet-50/50 to-purple-50/30 dark:from-violet-950/20 dark:to-purple-950/10 dark:border-violet-800/30 hover:shadow-lg hover:shadow-purple-500/10 transition-shadow',
    titleColor: 'text-violet-900 dark:text-violet-100',
    valueColor: 'text-violet-600 dark:text-violet-400',
    iconColor: 'text-violet-500',
    buttonHover: 'hover:bg-violet-100 hover:text-violet-700 hover:border-violet-300 dark:hover:bg-violet-950/50',
  },
]
