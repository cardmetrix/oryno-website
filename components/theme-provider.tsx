"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

type ThemeProviderProps = {
  children: React.ReactNode;
};

export function ThemeProvider({ children }: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="oryno-theme"
      // We paint the class ourselves for an instant, glitch-free toggle.
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
