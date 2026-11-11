import type { InputHTMLAttributes } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { VegetalEntryForm } from "@/lib/stockEntry";

export const MEMBER_SUGGESTIONS_LIST_ID = "members-list";

export interface VegetalEntryFieldConfig {
  name: keyof VegetalEntryForm;
  label: string;
  placeholder?: string;
  required?: boolean;
  /** Sugere nomes de membros cadastrados (datalist). */
  suggestMembers?: boolean;
  inputProps?: Pick<InputHTMLAttributes<HTMLInputElement>, "type" | "step" | "min" | "max" | "inputMode">;
}

interface VegetalEntryFieldProps {
  field: VegetalEntryFieldConfig;
  value: string;
  onChange: (name: keyof VegetalEntryForm, value: string) => void;
}

export function VegetalEntryField({ field, value, onChange }: VegetalEntryFieldProps) {
  return (
    <div className="space-y-2">
      <Label htmlFor={field.name}>
        {field.label}
        {field.required && <> <span className="text-destructive">*</span></>}
      </Label>
      <Input
        id={field.name}
        list={field.suggestMembers ? MEMBER_SUGGESTIONS_LIST_ID : undefined}
        placeholder={field.placeholder}
        aria-required={field.required}
        value={value}
        onChange={(e) => onChange(field.name, e.target.value)}
        {...field.inputProps}
      />
    </div>
  );
}
