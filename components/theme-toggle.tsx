"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  /** Compact icon button for headers/sidebars */
  variant?: "switch" | "icon";
  /** Optional callback after local theme change (e.g. persist to DB) */
  onCheckedChangePersist?: (isDark: boolean) => void;
};

const TRANSITION_MS = 420;

function startThemeTransition(apply: () => void) {
  if (typeof document === "undefined") {
    apply();
    return;
  }

  const root = document.documentElement;
  root.classList.add("theme-transition");

  // Allow the browser to paint the transition class before flipping theme.
  window.requestAnimationFrame(() => {
    window.requestAnimationFrame(() => {
      apply();
      window.setTimeout(() => {
        root.classList.remove("theme-transition");
      }, TRANSITION_MS);
    });
  });
}

export function ThemeToggle({
  className,
  variant = "switch",
  onCheckedChangePersist,
}: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const isDark = resolvedTheme === "dark";

  function apply(nextDark: boolean) {
    startThemeTransition(() => {
      setTheme(nextDark ? "dark" : "light");
      onCheckedChangePersist?.(nextDark);
    });
  }

  if (!mounted) {
    if (variant === "icon") {
      return (
        <span
          className={cn(
            "inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-background",
            className,
          )}
          aria-hidden
        />
      );
    }
    // Always controlled — avoids React warning when theme hydrates
    return <Switch disabled checked={false} className={className} />;
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        onClick={() => apply(!isDark)}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)] transition hover:bg-muted",
          className,
        )}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      >
        {isDark ? (
          <Sun className="h-4 w-4 text-foreground" strokeWidth={1.75} />
        ) : (
          <Moon className="h-4 w-4 text-foreground" strokeWidth={1.75} />
        )}
      </button>
    );
  }

  return (
    <Switch
      checked={isDark}
      onCheckedChange={(checked) => apply(checked)}
      aria-label="Toggle dark mode"
      className={className}
    />
  );
}
