import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { TERMS_OF_SERVICE } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Terms of Service · ORYNO",
  description:
    "ORYNO Terms of Service — rules for using our wallet and digital services.",
};

export default function TermsPage() {
  return (
    <LegalDocument
      title={TERMS_OF_SERVICE.title}
      intro={TERMS_OF_SERVICE.intro}
      sections={TERMS_OF_SERVICE.sections}
      otherHref="/privacy"
      otherLabel="Privacy Policy"
    />
  );
}
