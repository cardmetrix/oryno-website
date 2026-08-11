import { SUPPORT_EMAIL } from "@/lib/support/config";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export const LEGAL_EFFECTIVE_DATE = "August 11, 2026";
export const LEGAL_COMPANY = "ORYNO";
export const LEGAL_SUPPORT_EMAIL = SUPPORT_EMAIL;
export const LEGAL_WEBSITE = "https://www.orynoafrica.com";

export const TERMS_OF_SERVICE: {
  title: string;
  intro: string;
  sections: LegalSection[];
} = {
  title: "Terms of Service",
  intro:
    "These Terms of Service (“Terms”) govern your access to and use of ORYNO’s websites, mobile apps, wallet, and digital services (together, the “Services”). By creating an account, checking “I agree,” or using ORYNO, you accept these Terms.",
  sections: [
    {
      heading: "1. Who we are",
      paragraphs: [
        "ORYNO provides a multi-country digital services platform: wallet funding and withdrawals, airtime and data, bill payments, gift cards, virtual numbers, social boosting, and related features. Some features may be limited by country, KYC status, or availability.",
      ],
    },
    {
      heading: "2. Eligibility",
      paragraphs: [
        "You must be at least 18 years old (or the age of majority where you live) and able to form a binding contract. You may only open one personal account unless we expressly allow otherwise.",
      ],
    },
    {
      heading: "3. Your account",
      paragraphs: [
        "You are responsible for accurate registration details, keeping your password and transaction PIN confidential, and all activity under your account. Notify us immediately at the support email below if you suspect unauthorized access.",
        "We may require identity verification (KYC), device checks, or additional security steps before certain actions.",
      ],
    },
    {
      heading: "4. Wallet & payments",
      paragraphs: [
        "Funds in your ORYNO wallet are for use within the Services. Funding, withdrawals, conversions, and purchases are processed through licensed payment partners and telecom/bill providers. Settlement times depend on those partners and local networks.",
        "You authorize us to debit your wallet for purchases, fees, and corrections of obvious errors. Failed or reversed provider orders may be refunded to your wallet when we receive confirmation from the provider.",
      ],
    },
    {
      heading: "5. Acceptable use",
      paragraphs: [
        "You agree not to use ORYNO for unlawful activity, fraud, money laundering, sanction evasion, abuse of providers, automated scraping without permission, or anything that harms other users or our infrastructure.",
      ],
      bullets: [
        "No false identity, stolen cards, or unauthorized access to third-party accounts",
        "No attempts to reverse-engineer, disrupt, or overload the Services",
        "No resale of restricted virtual products in violation of issuer rules",
      ],
    },
    {
      heading: "6. Fees & rates",
      paragraphs: [
        "Applicable fees, FX spreads, and gift-card rates are shown in the app or website before you confirm a transaction. Network and partner fees may apply. We may update fees with reasonable notice where required by law.",
      ],
    },
    {
      heading: "7. Third-party providers",
      paragraphs: [
        "ORYNO integrates payment gateways, SMS/email providers, telecom and bill aggregators, gift-card partners, and support tools. Their terms and availability may affect your transaction. We are not responsible for outages or delays caused solely by those providers, but we will help investigate and process refunds when appropriate.",
      ],
    },
    {
      heading: "8. Intellectual property",
      paragraphs: [
        "ORYNO’s name, logo, product design, and software are owned by us or our licensors. You receive a limited, non-exclusive license to use the Services for personal or authorized business use. You may not copy or redistribute our materials without permission.",
      ],
    },
    {
      heading: "9. Suspension & termination",
      paragraphs: [
        "We may suspend or close accounts that violate these Terms, present risk, fail KYC, or are inactive. You may stop using ORYNO at any time. Remaining wallet balances may be withdrawn subject to verification, payout limits, and applicable law.",
      ],
    },
    {
      heading: "10. Disclaimers & liability",
      paragraphs: [
        "Services are provided “as is” to the fullest extent permitted by law. We do not guarantee uninterrupted availability. To the maximum extent allowed, ORYNO’s total liability for claims relating to the Services is limited to the fees you paid us in the three months before the claim (or the amount of the disputed transaction, if higher and required by law).",
        "Nothing in these Terms excludes liability that cannot be limited under applicable law.",
      ],
    },
    {
      heading: "11. Changes",
      paragraphs: [
        "We may update these Terms from time to time. Material changes will be posted on this page with an updated effective date. Continued use after changes take effect means you accept the revised Terms.",
      ],
    },
    {
      heading: "12. Contact",
      paragraphs: [
        `Questions about these Terms: ${SUPPORT_EMAIL}. Website: ${LEGAL_WEBSITE}.`,
      ],
    },
  ],
};

export const PRIVACY_POLICY: {
  title: string;
  intro: string;
  sections: LegalSection[];
} = {
  title: "Privacy Policy",
  intro:
    "This Privacy Policy explains how ORYNO collects, uses, shares, and protects personal information when you use our websites, apps, and Services. By using ORYNO, you acknowledge this Policy.",
  sections: [
    {
      heading: "1. Information we collect",
      paragraphs: [
        "Depending on how you use ORYNO, we may collect:",
      ],
      bullets: [
        "Account data: name, username, email, phone, country, password hashes / auth provider IDs",
        "Identity & KYC data: documents and verification results where required",
        "Wallet & transaction data: balances, funding, withdrawals, purchases, references",
        "Device & security data: device identifiers, IP address, login events, PIN status (not the clear PIN)",
        "Support data: tickets, chat messages, and attachments you send us",
        "Marketing preferences and waitlist sign-ups you choose to join",
      ],
    },
    {
      heading: "2. How we use information",
      paragraphs: [
        "We use personal information to provide and improve the Services, process payments, prevent fraud, meet legal and regulatory obligations, send transactional notices (receipts, security alerts), and — with your consent or where allowed — product updates.",
      ],
    },
    {
      heading: "3. Sharing",
      paragraphs: [
        "We share data only as needed with payment and banking partners; service providers for airtime, data, bills, gift cards, virtual numbers, and messaging; authentication, hosting, analytics, email, and customer-support vendors; and authorities when required by law or to protect rights and safety.",
        "We do not sell your personal information.",
      ],
      bullets: [
        "Payment and banking partners (e.g. card/bank funding and payouts)",
        "Telecom, bill, gift-card, and messaging providers that fulfill your orders",
        "Auth, hosting, analytics, email, and support vendors under contract",
        "Regulators or law enforcement when legally required",
      ],
    },
    {
      heading: "4. Cookies & similar tech",
      paragraphs: [
        "Our website may use cookies and similar technologies for authentication, preferences, security, and performance. You can control cookies through your browser settings; some features may not work without them.",
      ],
    },
    {
      heading: "5. Retention",
      paragraphs: [
        "We keep account and transaction records for as long as your account is active and as required for legal, tax, dispute, and fraud-prevention purposes. Support messages and device logs may be retained for a shorter operational period.",
      ],
    },
    {
      heading: "6. Security",
      paragraphs: [
        "We use industry-standard safeguards including encryption in transit, access controls, and optional transaction PINs. No method of transmission or storage is 100% secure; please use a strong password and protect your devices.",
      ],
    },
    {
      heading: "7. Your choices",
      paragraphs: [
        "You may update profile details in Settings, manage notification preferences, join or leave product waitlists, and request account closure via support. Subject to local law, you may also request access, correction, or deletion of personal data.",
      ],
    },
    {
      heading: "8. Children",
      paragraphs: [
        "ORYNO is not directed to children under 18. We do not knowingly collect personal information from children. If you believe a child has provided data, contact us and we will take appropriate steps.",
      ],
    },
    {
      heading: "9. International transfers",
      paragraphs: [
        "We may process data in countries other than where you live, including with cloud and payment partners. We take steps designed to protect information in line with this Policy and applicable law.",
      ],
    },
    {
      heading: "10. Changes",
      paragraphs: [
        "We may update this Privacy Policy periodically. The effective date at the top of the page will change when we do. Continued use of ORYNO after an update means you acknowledge the revised Policy.",
      ],
    },
    {
      heading: "11. Contact",
      paragraphs: [
        `Privacy questions or requests: ${SUPPORT_EMAIL}. Website: ${LEGAL_WEBSITE}.`,
      ],
    },
  ],
};
