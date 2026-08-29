"use client";

import { useState, useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type ThemeToggleProps = {
  className?: string;
  /** Compact icon button for headers/sidebars */
  variant?: "switch" | "icon";
  disabled?: boolean;
  /** Optional callback after local theme change (e.g. persist to DB) */
  onCheckedChangePersist?: (isDark: boolean) => void | Promise<void>;
};

const STORAGE_KEY = "oryno-theme";

function subscribeTheme(onChange: () => void) {
  if (typeof document === "undefined") return () => undefined;
  const root = document.documentElement;
  const obs = new MutationObserver(onChange);
  obs.observe(root, { attributes: true, attributeFilter: ["class"] });
  window.addEventListener("storage", onChange);
  return () => {
    obs.disconnect();
    window.removeEventListener("storage", onChange);
  };
}

function getIsDark() {
  return document.documentElement.classList.contains("dark");
}

function getServerIsDark() {
  return false;
}

function paintTheme(nextDark: boolean) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const next = nextDark ? "dark" : "light";

  // Kill color transitions for one frame so surfaces don't stagger/glitch.
  root.classList.add("disable-theme-transitions");
  root.classList.toggle("dark", nextDark);
  root.style.colorScheme = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    // ignore private-mode quota
  }
  void root.offsetHeight;
  requestAnimationFrame(() => {
    root.classList.remove("disable-theme-transitions");
  });
}

export function ThemeToggle({
  className,
  variant = "switch",
  disabled = false,
  onCheckedChangePersist,
}: ThemeToggleProps) {
  const { setTheme } = useTheme();
  const [busy, setBusy] = useState(false);
  const isDark = useSyncExternalStore(subscribeTheme, getIsDark, getServerIsDark);
  const locked = disabled || busy;

  function apply(nextDark: boolean) {
    if (locked || nextDark === isDark) return;
    paintTheme(nextDark);
    setTheme(nextDark ? "dark" : "light");
    const persist = onCheckedChangePersist?.(nextDark);
    if (persist && typeof persist.then === "function") {
      setBusy(true);
      void persist.finally(() => setBusy(false));
    }
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        data-theme-toggle=""
        disabled={locked}
        onClick={() => apply(!isDark)}
        className={cn(
          "inline-flex h-10 w-10 items-center justify-center rounded-[14px] border border-border bg-background shadow-[var(--shadow-soft)] hover:bg-muted disabled:pointer-events-none disabled:opacity-50",
          className,
        )}
        aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        suppressHydrationWarning
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
      disabled={locked}
      onCheckedChange={(checked) => apply(checked)}
      aria-label="Toggle dark mode"
      data-theme-toggle=""
      className={className}
    />
  );
}
