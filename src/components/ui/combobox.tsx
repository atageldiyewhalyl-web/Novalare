"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/components/ui/utils"
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

export interface ComboboxOption {
    value: string;
    label: string;
    original?: any;
}

interface ComboboxProps {
    items: any[];
    value: any;
    onChange: (value: any) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    emptyText?: string;
    className?: string;
    label?: string; // Unused but kept for prop compatibility if needed
    valueKey?: string;
    labelKey?: string;
}

export function Combobox({
    items = [],
    value,
    onChange,
    placeholder = "Select item...",
    searchPlaceholder = "Search...",
    emptyText = "No item found.",
    className,
    valueKey = "id",
    labelKey = "name"
}: ComboboxProps) {
    const [open, setOpen] = React.useState(false)

    // Determine current label
    const currentLabel = value ? (value[labelKey] || value.label) : placeholder;

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className={cn("w-full justify-between", className)}
                >
                    <span className="truncate">
                        {value
                            ? `${value.code ? value.code + ' - ' : ''}${value[labelKey]}`
                            : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandList>
                        <CommandEmpty>{emptyText}</CommandEmpty>
                        <CommandGroup>
                            {items.map((item) => {
                                // Handle different item structures or use default keys
                                const itemValue = item[valueKey] || item.value;
                                const itemLabel = item[labelKey] || item.label;
                                const itemCode = item.code;
                                const displayLabel = itemCode ? `${itemCode} - ${itemLabel}` : itemLabel;

                                return (
                                    <CommandItem
                                        key={itemValue}
                                        value={displayLabel} // Use display label for search matching
                                        onSelect={() => {
                                            onChange(item)
                                            setOpen(false)
                                        }}
                                    >
                                        <Check
                                            className={cn(
                                                "mr-2 h-4 w-4",
                                                (value && (value[valueKey] === itemValue)) ? "opacity-100" : "opacity-0"
                                            )}
                                        />
                                        {displayLabel}
                                    </CommandItem>
                                )
                            })}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
