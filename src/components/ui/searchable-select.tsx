"use client"

import { type ReactNode, useMemo, useState } from "react"
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

  const selectedOption = useMemo(
    () => options.find((option) => option.value === value),
    [options, value]
  )

  const { groupedEntries, ungrouped } = useMemo(() => {
    const ungroupedOptions: SearchableSelectOption[] = []
    const groupedMap = new Map<string, SearchableSelectOption[]>()

    for (const option of options) {
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
  }, [options])

  const hasGroups = groupedEntries.length > 0

  const renderItem = (option: SearchableSelectOption) => (
    <CommandItem
      key={option.value}
      value={option.label}
      keywords={option.keywords}
      disabled={option.disabled}
      onSelect={() => {
        onValueChange(option.value)
        setOpen(false)
      }}
    >
      <Check
        className={cn(
          "mr-2 h-4 w-4",
          option.value === value ? "opacity-100" : "opacity-0"
        )}
      />
      {renderOption ? renderOption(option) : option.label}
    </CommandItem>
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn("w-full justify-between", className)}
          disabled={disabled}
        >
          {selectedOption ? (
            selectedOption.label
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn("w-[var(--radix-popover-trigger-width)] p-0", contentClassName)}
      >
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
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
