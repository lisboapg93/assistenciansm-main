import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { normalizeName } from "@/lib/memberDisplay";
import { cn } from "@/lib/utils";

interface MemberAutocompleteInputProps extends Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "list"
> {
  value: string;
  onValueChange: (value: string) => void;
  options: string[];
  emptyMessage?: string;
}

export function MemberAutocompleteInput({
  value,
  onValueChange,
  options,
  emptyMessage = "Nenhum membro encontrado.",
  className,
  ...inputProps
}: MemberAutocompleteInputProps) {
  const [open, setOpen] = useState(false);
  const listId = useId();
  const normalizedValue = normalizeName(value);

  const filteredOptions = useMemo(
    () => [...new Set(options)]
      .filter((option) => normalizeName(option).includes(normalizedValue))
      .slice(0, 50),
    [normalizedValue, options],
  );

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <Input
          {...inputProps}
          value={value}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          className={className}
          onChange={(event) => {
            const nextValue = event.target.value;
            onValueChange(nextValue);
            setOpen(nextValue.trim().length > 0);
          }}
        />
      </PopoverAnchor>
      <PopoverContent
        id={listId}
        align="start"
        className="w-[var(--radix-popover-trigger-width)] max-h-64 overflow-y-auto p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        {filteredOptions.length > 0 ? (
          <div role="listbox" className="space-y-1">
            {filteredOptions.map((option) => (
              <Button
                key={option}
                type="button"
                variant="ghost"
                className={cn(
                  "min-h-10 h-auto w-full justify-start whitespace-normal px-3 py-2 text-left",
                  option === value && "bg-accent",
                )}
                role="option"
                aria-selected={option === value}
                onClick={() => {
                  onValueChange(option);
                  setOpen(false);
                }}
              >
                {option}
              </Button>
            ))}
          </div>
        ) : (
          <p className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</p>
        )}
      </PopoverContent>
    </Popover>
  );
}
