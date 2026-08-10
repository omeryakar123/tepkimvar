import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

export type ComboOption = { value: string; label: string };

/**
 * Aranabilir tek-seçim combobox (cmdk + Radix Popover).
 * Eski "arama input'u + ayrı select" ikilisinin yerine geçer.
 */
export function Combobox({
  options,
  value,
  onChange,
  placeholder = "Seçiniz…",
  searchPlaceholder = "Ara…",
  emptyText = "Sonuç yok.",
  className,
  id,
}: {
  options: ComboOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyText?: string;
  className?: string;
  id?: string;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          id={id}
          role="combobox"
          aria-expanded={open}
          className={cn(
            "flex w-full h-11 items-center justify-between rounded-lg ring-1 ring-rule bg-card px-3 text-sm transition focus:outline-none focus:ring-2 focus:ring-brand/40",
            !selected && "text-navy-mid",
            className,
          )}
        >
          <span className="truncate">{selected ? selected.label : placeholder}</span>
          <ChevronsUpDown className="size-4 shrink-0 text-navy-mid" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width] max-w-none"
        align="start"
      >
        <Command
          // Türkçe uyumlu filtre (İ/ı, büyük-küçük harf).
          filter={(val, search) => {
            const opt = options.find((o) => o.value === val);
            const hay = (opt?.label ?? val).toLocaleLowerCase("tr");
            return hay.includes(search.toLocaleLowerCase("tr")) ? 1 : 0;
          }}
        >
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => (
                <CommandItem
                  key={o.value}
                  value={o.value}
                  onSelect={(v) => {
                    onChange(v === value ? "" : v);
                    setOpen(false);
                  }}
                >
                  <Check className={cn("mr-2 size-4", value === o.value ? "opacity-100 text-brand" : "opacity-0")} />
                  {o.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
