"use client"

import { type ReactNode, useCallback, useEffect, useId, useMemo, useRef, useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

export interface SearchableSelectOption {
  value: string
  label: string
  group?: string
  keywords?: string[]
  disabled?: boolean
}

interface SearchableSelectProps {
  value?: string
  options: SearchableSelectOption[]
  onValueChange: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyMessage?: string
  disabled?: boolean
  className?: string
  contentClassName?: string
  renderOption?: (option: SearchableSelectOption) => ReactNode
}

function normalizeSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
}

export function SearchableSelect({
  value,
  options,
  onValueChange,
  placeholder = "Selecione...",
  searchPlaceholder = "Buscar...",
  emptyMessage = "Nenhuma opção encontrada.",
  disabled = false,
  className,
  contentClassName,
  renderOption,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const listId = useId()
  const listRef = useRef<HTMLDivElement>(null)

  const resetListScroll = useCallback(() => {
    requestAnimationFrame(() => {
      listRef.current?.scrollTo({ top: 0 })
    })
  }, [])

  const handleOpenChange = useCallback((nextOpen: boolean) => {
    setOpen(nextOpen)
    setSearch("")

    if (nextOpen) {
      resetListScroll()
    }
  }, [resetListScroll])

  useEffect(() => {
    if (!open) {
      return
    }

    resetListScroll()
  }, [open, search, resetListScroll])

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )

  const filteredOptions = useMemo(() => {
    const normalizedSearch = normalizeSearchText(search)

    if (!normalizedSearch) {
      return options
    }

    return options.filter((option) => {
      const candidates = [option.label, option.value, ...(option.keywords ?? [])]

      return candidates.some((candidate) =>
        normalizeSearchText(candidate).includes(normalizedSearch)
      )
    })
  }, [options, search])

  const { groupedEntries, ungrouped } = useMemo(() => {
    const ungroupedOptions: SearchableSelectOption[] = []
    const groupedMap = new Map<string, SearchableSelectOption[]>()

    for (const option of filteredOptions) {
      if (!option.group) {
        ungroupedOptions.push(option)
        continue
      }

      const groupOptions = groupedMap.get(option.group)
      if (groupOptions) {
        groupOptions.push(option)
        continue
      }

      groupedMap.set(option.group, [option])
    }

    return {
      groupedEntries: Array.from(groupedMap.entries()),
      ungrouped: ungroupedOptions,
    }
  }, [filteredOptions])

  const hasGroups = groupedEntries.length > 0

  const renderItem = (option: SearchableSelectOption) => (
    <CommandItem
      key={option.value}
      value={option.value}
      keywords={option.keywords}
      disabled={option.disabled}
      onSelect={() => {
        onValueChange(option.value)
        setSearch("")
        setOpen(false)
      }}
    >
      <Check
        className={cn(
          "mr-2 size-4",
          option.value === value ? "opacity-100" : "opacity-0"
        )}
      />
      {renderOption ? renderOption(option) : option.label}
    </CommandItem>
  )

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedOption ? (
            selectedOption.label
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[var(--radix-popover-trigger-width)] p-0", contentClassName)}
      >
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={searchPlaceholder}
            value={search}
            onValueChange={setSearch}
          />
          <CommandList id={listId} ref={listRef}>
            <CommandEmpty>{emptyMessage}</CommandEmpty>
            {ungrouped.length > 0 && <CommandGroup>{ungrouped.map(renderItem)}</CommandGroup>}
            {hasGroups &&
              groupedEntries.map(([groupName, groupOptions]) => (
                <CommandGroup key={groupName} heading={groupName}>
                  {groupOptions.map(renderItem)}
                </CommandGroup>
              ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
