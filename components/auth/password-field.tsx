"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { AuthField, authInputClassName } from "./auth-field";
import { cn } from "@/lib/utils";

type PasswordFieldProps = {
  label: string;
  name: string;
  placeholder?: string;
  autoComplete?: string;
  required?: boolean;
};

export function PasswordField({
  label,
  name,
  placeholder,
  autoComplete,
  required,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <AuthField label={label}>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          name={name}
          placeholder={placeholder}
          autoComplete={autoComplete}
          required={required}
          className={cn(authInputClassName, "pr-12")}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute top-1/2 right-3 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? (
            <EyeOff className="h-5 w-5" strokeWidth={1.75} />
          ) : (
            <Eye className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>
      </div>
    </AuthField>
  );
}
