import Link from "next/link";
import { BrandLogo } from "@/components/brand-logo";
import {
  LEGAL_EFFECTIVE_DATE,
  type LegalSection,
} from "@/lib/legal/content";

type LegalDocumentProps = {
  title: string;
  intro: string;
  sections: LegalSection[];
  otherHref: string;
  otherLabel: string;
};

export function LegalDocument({
  title,
  intro,
  sections,
  otherHref,
  otherLabel,
}: LegalDocumentProps) {
  return (
    <div className="min-h-[100svh] bg-background text-foreground">
      <header className="border-b border-border/80 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-3xl items-center justify-between gap-4 px-5 py-4 sm:px-6">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <BrandLogo size={36} className="shadow-[var(--shadow-orange)]" />
            <span className="text-lg font-bold tracking-tight">ORYNO</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm font-semibold">
            <Link
              href={otherHref}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              {otherLabel}
            </Link>
            <Link
              href="/register"
              className="text-primary transition-colors hover:text-oryno-charcoal"
            >
              Create account
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-10 sm:px-6 sm:py-14">
        <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">
          Legal
        </p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective date: {LEGAL_EFFECTIVE_DATE}
        </p>
        <p className="mt-6 text-[15px] leading-relaxed text-muted-foreground">
          {intro}
        </p>

        <div className="mt-10 space-y-8">
          {sections.map((section) => (
            <section key={section.heading} className="space-y-3">
              <h2 className="text-lg font-bold tracking-tight text-foreground">
                {section.heading}
              </h2>
              {section.paragraphs.map((p) => (
                <p
                  key={p.slice(0, 48)}
                  className="text-[15px] leading-relaxed text-muted-foreground"
                >
                  {p}
                </p>
              ))}
              {section.bullets?.length ? (
                <ul className="list-disc space-y-2 pl-5 text-[15px] leading-relaxed text-muted-foreground">
                  {section.bullets.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              ) : null}
            </section>
          ))}
        </div>

        <div className="mt-12 flex flex-wrap gap-3 border-t border-border pt-8 text-sm font-semibold">
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/register" className="text-primary hover:underline">
            Back to Create Account
          </Link>
        </div>
      </main>
    </div>
  );
}
