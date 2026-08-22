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
      // Keep transitions on for smooth light ↔ dark; hydration flash is avoided
      // by defaultTheme="light" + suppressHydrationWarning on <html>.
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
