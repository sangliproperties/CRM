import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem } from "@/components/ui/command";

type Option = {
    value: string;
    label: string;
    keywords?: string; // for searching additional fields
};

export function SearchableComboBox({
    value,
    onChange,
    placeholder,
    searchPlaceholder = "Search...",
    emptyText = "No results found.",
    options,
}: {
    value?: string;
    onChange: (value?: string) => void;
    placeholder: string;
    searchPlaceholder?: string;
    emptyText?: string;
    options: Option[];
}) {
    const [open, setOpen] = React.useState(false);

    const selected = options.find((o) => o.value === value);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between">
                    {selected ? selected.label : placeholder}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>

            <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command
                    filter={(itemValue, search) => {
                        const opt = options.find((o) => o.value === itemValue);
                        const haystack = (opt?.label + " " + (opt?.keywords ?? "")).toLowerCase();
                        return haystack.includes(search.toLowerCase()) ? 1 : 0;
                    }}
                >
                    <CommandInput placeholder={searchPlaceholder} />
                    <CommandEmpty>{emptyText}</CommandEmpty>

                    <CommandGroup>
                        {options.map((opt) => (
                            <CommandItem
                                key={opt.value}
                                value={opt.value}
                                onSelect={() => {
                                    onChange(opt.value);
                                    setOpen(false);
                                }}
                            >
                                <Check className={cn("mr-2 h-4 w-4", value === opt.value ? "opacity-100" : "opacity-0")} />
                                {opt.label}
                            </CommandItem>
                        ))}
                    </CommandGroup>
                </Command>
            </PopoverContent>
        </Popover>
    );
}
