import { SUPPORT_EMAIL } from "@/lib/support/config";

export type LegalSection = {
  heading: string;
  paragraphs: string[];
  bullets?: string[];
};

export const LEGAL_EFFECTIVE_DATE = "September 25, 2026";
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
    "These Terms of Service (“Terms”) govern your access to and use of ORYNO’s websites, mobile apps, wallets, and digital services (together, the “Services”). By creating an account, checking “I agree,” or using ORYNO, you accept these Terms.",
  sections: [
    {
      heading: "1. Who we are",
      paragraphs: [
        "ORYNO is a digital services platform. Depending on your country, the live Services include a local-currency wallet and a USD wallet; airtime and data; electricity and TV bill payments; betting-account funding; social boosting; virtual numbers; gift cards paid from USD; a free invoice generator; and payment links.",
        "Some products are marked Coming Soon. USD virtual cards and International Gifting are waitlists until we tell you they have launched. Joining a waitlist does not reserve a product, a price, or a launch date.",
      ],
    },
    {
      heading: "2. Eligibility",
      paragraphs: [
        "You must be at least 18 years old (or the age of majority where you live) and able to form a binding contract. You may only open one personal account unless we expressly allow otherwise. Some Services are available only in selected countries.",
      ],
    },
    
    {
      heading: "3. Your account",
      paragraphs: [
        "You are responsible for accurate registration details (including your name, email, phone, and country), for keeping your password and transaction PIN confidential, and for all activity under your account. Tell us immediately at the support email below if you suspect unauthorized access.",
        "Ordinary use of ORYNO does not require you to upload identity documents. We may still pause a transaction or ask for extra information if we need it to prevent fraud, resolve a dispute, or meet a legal obligation.",
      ],
    },
    {
      heading: "4. Wallets & payments",
      paragraphs: [
        "ORYNO gives you a local-currency wallet and a USD wallet. You can fund the local wallet through our payment partners (including card, bank transfer, or a dedicated virtual account, where available) and convert between local currency and USD at the rate shown before you confirm. Gift cards and other USD-priced products are paid from your USD balance.",
        "Wallet balances are for use inside the Services. ORYNO does not offer a general bank cash-out. You authorize us to debit the relevant wallet for purchases, fees, conversions, and corrections of obvious errors. If a provider order fails or is reversed, we refund the wallet we charged once we have confirmation from that provider.",
        "Payment links send a payer to a checkout operated by our payment partner. The link creator is responsible for the description, amount, and delivery of whatever they are charging for. ORYNO provides the tool and does not become the seller of those goods or services.",
      ],
    },
    {
      heading: "5. Services",
      paragraphs: [
        "Each purchase shows the provider, amount, and any fee before you confirm. Delivery times depend on the network or partner. Social boost, virtual numbers, betting credits, and gift-card codes are fulfilled by third parties and are subject to their rules.",
        "The invoice generator is free to use. You are responsible for the accuracy of invoices you create and for complying with tax rules that apply to you. A downloaded PDF is a record you produce in ORYNO; it is not a tax invoice issued by ORYNO unless we say otherwise.",
      ],
    },
    {
      heading: "6. Acceptable use",
      paragraphs: [
        "You agree not to use ORYNO for unlawful activity, fraud, money laundering, sanction evasion, abuse of providers, automated scraping without permission, or anything that harms other users or our infrastructure.",
      ],
      bullets: [
        "No false identity, stolen payment methods, or unauthorized access to third-party accounts",
        "No attempts to reverse-engineer, disrupt, or overload the Services",
        "No resale of gift cards, virtual numbers, or other restricted products in violation of the issuer’s rules",
        "No payment links or invoices used to collect money for illegal or deceptive activity",
      ],
    },
    {
      heading: "7. Fees & rates",
      paragraphs: [
        "Prices, FX rates (including any ORYNO commission on conversion), and partner fees are shown in the app or website before you confirm. The invoice generator itself is free. Payment-link checkouts may include fees charged by the payment partner and disclosed at checkout. We may update fees with reasonable notice where the law requires it.",
      ],
    },
    {
      heading: "8. Third-party providers",
      paragraphs: [
        "ORYNO integrates payment gateways, telecom and bill aggregators, betting platforms, social-boost suppliers, virtual-number providers, gift-card issuers, and support tools. Their terms and availability can affect your order. We are not responsible for outages or delays caused solely by those providers, and we will help investigate and process a wallet refund when the provider confirms the order failed.",
      ],
    },
    {
      heading: "9. Intellectual property",
      paragraphs: [
        "ORYNO’s name, logo, product design, and software are owned by us or our licensors. You receive a limited, non-exclusive license to use the Services for personal or authorized business use. You may not copy or redistribute our materials without permission. Invoices and payment-link content you enter remain yours; you give us a license to store and display that content so we can provide the Service.",
      ],
    },
    {
      heading: "10. Suspension & termination",
      paragraphs: [
        "We may suspend or close accounts that violate these Terms, present fraud or security risk, or are used in a way that harms other users or our partners. You may stop using ORYNO at any time and may ask support to close your account.",
        "Because we do not offer general bank withdrawals, a remaining balance stays available for Services until the account is closed. On closure we will, where the law requires a return of funds, tell you how any unused balance will be handled.",
      ],
    },
    {
      heading: "11. Disclaimers & liability",
      paragraphs: [
        "Services are provided “as is” to the fullest extent permitted by law. We do not guarantee uninterrupted availability, a particular FX rate after you leave the confirmation screen, or that a Coming Soon product will launch. To the maximum extent allowed, ORYNO’s total liability for claims relating to the Services is limited to the fees you paid us in the three months before the claim, or the amount of the disputed transaction if a higher limit is required by law.",
        "Nothing in these Terms excludes liability that cannot be limited under applicable law.",
      ],
    },
    {
      heading: "12. Changes",
      paragraphs: [
        "We may update these Terms from time to time. Material changes will be posted on this page with an updated effective date. Continued use after changes take effect means you accept the revised Terms.",
      ],
    },
    {
      heading: "13. Contact",
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
      paragraphs: ["Depending on how you use ORYNO, we may collect:"],
      bullets: [
        "Account data: name, username, email, phone, country, and authentication-provider IDs",
        "Wallet data: local and USD balances, funding, conversions, purchases, and payment references",
        "Order data: phone numbers for airtime or data, meter or smartcard details for bills, betting customer IDs, social-boost links, virtual-number orders, and gift-card purchases",
        "Business-tool data you enter: invoice parties, line items, notes, and payment-link amounts and descriptions",
        "Security data: device and IP address, login events, and whether a transaction PIN is set (we do not store the PIN in clear text)",
        "Support data: tickets, live-chat messages, and files you send us",
        "Waitlist data: email and notification preferences when you join a Coming Soon list, such as USD virtual cards or International Gifting",
      ],
    },
    {
      heading: "2. How we use information",
      paragraphs: [
        "We use personal information to create and secure your account, run wallets and conversions, fulfill orders with our partners, generate invoices and payment links you request, prevent fraud, send receipts and security alerts, and — where you opt in — tell you when a waitlisted product launches. We do not require identity-document uploads for ordinary use of the Services.",
      ],
    },
    {
      heading: "3. Sharing",
      paragraphs: [
        "We share data only as needed to run the Services. We do not sell your personal information.",
      ],
      bullets: [
        "Payment partners that collect wallet funding and process payment links",
        "Telecom, electricity, TV, betting, social-boost, virtual-number, and gift-card providers that fulfill the order you confirm",
        "Authentication, hosting, email, push-notification, analytics, and customer-support vendors under contract",
        "A card issuer, only if and when USD virtual cards are issued to you",
        "Regulators or law enforcement when legally required, or when needed to protect users and the Services",
      ],
    },
    {
      heading: "4. Cookies & similar tech",
      paragraphs: [
        "Our website may use cookies and similar technologies for sign-in, preferences, security, and performance. You can control cookies in your browser. The mobile app uses similar local storage and device identifiers for sign-in and notifications. Some features will not work if those are blocked.",
      ],
    },
    {
      heading: "5. Retention",
      paragraphs: [
        "We keep account, wallet, and order records for as long as your account is active and for as long as we need them for tax, disputes, fraud prevention, and legal duties. Invoice and payment-link content is kept so you can reopen it. Waitlist entries are deleted when you leave the list or after the related product launches and the notice has been sent. Support messages and device logs may be kept for a shorter operational period.",
      ],
    },
    {
      heading: "6. Security",
      paragraphs: [
        "We use safeguards including encryption in transit, access controls, and a transaction PIN for sensitive actions such as revealing card details where that product is available. No method of transmission or storage is completely secure. Use a strong password and protect your devices.",
      ],
    },
    {
      heading: "7. Your choices",
      paragraphs: [
        "You can update profile details and notification preferences in Settings, join or leave product waitlists, and ask support to close your account. Subject to local law, you may also request access to, correction of, or deletion of personal data. We may keep records we are legally required to retain.",
      ],
    },
    {
      heading: "8. Children",
      paragraphs: [
        "ORYNO is not directed to anyone under 18. We do not knowingly collect personal information from children. If you believe a child has provided data, contact us and we will delete it.",
      ],
    },
    {
      heading: "9. International transfers",
      paragraphs: [
        "We and our partners may process data in countries other than where you live, including where cloud, payment, and fulfillment providers operate. We take steps designed to protect that information in line with this Policy and applicable law.",
      ],
    },
    {
      heading: "10. Changes",
      paragraphs: [
        "We may update this Privacy Policy. The effective date at the top of the page will change when we do. Continued use of ORYNO after an update means you acknowledge the revised Policy.",
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
