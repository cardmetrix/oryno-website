import type { Metadata } from "next";
import { LegalDocument } from "@/components/legal/legal-document";
import { PRIVACY_POLICY } from "@/lib/legal/content";

export const metadata: Metadata = {
  title: "Privacy Policy · ORYNO",
  description:
    "ORYNO Privacy Policy — how we collect, use, and protect your information.",
};

export default function PrivacyPage() {
  return (
    <LegalDocument
      title={PRIVACY_POLICY.title}
      intro={PRIVACY_POLICY.intro}
      sections={PRIVACY_POLICY.sections}
      otherHref="/terms"
      otherLabel="Terms of Service"
    />
  );
}
