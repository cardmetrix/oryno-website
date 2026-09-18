import { BrandLogo } from "@/components/brand-logo";

const footerLinks = [
  {
    title: "Product",
    links: [
      { href: "#features", label: "Features" },
      { href: "#wallet", label: "Wallet" },
      { href: "#testimonials", label: "Reviews" },
      { href: "#download", label: "Download" },
    ],
  },
  {
    title: "Support",
    links: [
      { href: "/support", label: "Help Center" },
      { href: "/support", label: "Live Chat" },
      { href: "mailto:support@orynoafrica.com", label: "Contact" },
      { href: "/support", label: "FAQ" },
    ],
  },
  {
    title: "Company",
    links: [
      { href: "/about", label: "About" },
      { href: "/terms", label: "Terms of Service" },
      { href: "/privacy", label: "Privacy Policy" },
      { href: "/support", label: "Help" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-background">
      <div className="mx-auto w-full max-w-6xl px-5 py-14 sm:px-6 md:max-w-none">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
          <div>
            <a href="#top" className="inline-flex items-center gap-2.5">
              <BrandLogo size={36} className="shadow-[var(--shadow-orange)]" />
              <span className="text-lg font-bold tracking-tight text-foreground">
                ORYNO
              </span>
            </a>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Your Digital World, Simplified. A premium digital services
              platform built for clarity, speed, and trust.
            </p>
          </div>

          {footerLinks.map((group) => (
            <div key={group.title}>
              <p className="text-sm font-semibold text-foreground">
                {group.title}
              </p>
              <ul className="mt-4 space-y-2.5">
                {group.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} ORYNO. All rights reserved.
          </p>
          <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
            <a
              href="/terms"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Terms
            </a>
            <a
              href="/privacy"
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              Privacy
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
