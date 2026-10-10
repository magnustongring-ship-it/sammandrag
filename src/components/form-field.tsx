"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

type FieldProps = {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  hint?: string;
} & Omit<React.ComponentProps<"input">, "name" | "value" | "onChange">;

// Fält med etikett, hjälptext och felmeddelande. Ett fel markerar fältet
// (aria-invalid ger röd ram) och kopplas till fältet för skärmläsare.
export function FormField({
  name,
  label,
  value,
  onChange,
  error,
  hint,
  type = "text",
  className,
  ...props
}: FieldProps) {
  const [visible, setVisible] = useState(false);
  const password = type === "password";
  const describedBy = error ? `${name}-error` : hint ? `${name}-hint` : undefined;

  return (
    <div className="grid gap-2">
      <Label htmlFor={name} className={cn(error && "text-destructive")}>
        {label}
      </Label>
      <div className="relative">
        <Input
          id={name}
          name={name}
          type={password && visible ? "text" : type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={cn(password && "pr-10", className)}
          {...props}
        />
        {password && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? `Dölj ${label.toLowerCase()}` : `Visa ${label.toLowerCase()}`}
            aria-pressed={visible}
            aria-controls={name}
            className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
      {error ? (
        <p id={`${name}-error`} className="text-xs font-medium text-destructive">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${name}-hint`} className="text-xs text-muted-foreground">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
