export type SogoCardType = "ecode" | "physical";

export type SogoPhysicalSubType =
  | "cash_receipt"
  | "debit_receipt"
  | "no_receipt";

export type SogoCatalogBrand = {
  slug: string;
  name: string;
  currencies: string[];
  denominations: number[];
  card_types: SogoCardType[];
  requires_pin?: boolean;
  is_active?: boolean;
  /** Optional image from provider; we usually map locally */
  image?: string | null;
};

export type SogoRateEntry = {
  slug: string;
  name: string;
  rates: Record<
    string,
    Partial<
      Record<
        SogoCardType,
        | number
        | { NGN?: number }
        | Record<string, number | Record<string, number>>
      >
    >
  >;
};

export type SogoMoney = {
  raw: number;
  formatted: string;
  currency: string;
};

export type SogoSellResponse = {
  id: string;
  reference: string;
  card_name: string;
  card_country: string;
  card_type: SogoCardType;
  sub_type: string | null;
  card_amount: number;
  card_currency: string;
  payout_amount: SogoMoney;
  status: string;
  created_at: string;
};

export type SogoApiError = {
  error?: {
    code?: string;
    message?: string;
    doc_url?: string;
    errors?: Record<string, string[] | string>;
  };
  errors?: Record<string, string[] | string>;
  message?: string;
};

export type SogoWebhookEvent = {
  id: string;
  event: string;
  created_at: string;
  data: {
    object?: string;
    id?: string;
    reference?: string;
    type?: string;
    status?: string;
    amount?: number;
    fee?: number;
    net_amount?: number;
    currency?: string;
    description?: string;
    failure_reason?: string | null;
    completed_at?: string | null;
    created_at?: string;
    payout_amount?: SogoMoney | number;
    token?: string | null;
    prepaid_token?: string | null;
  };
};

export type GiftCardBrandView = {
  slug: string;
  name: string;
  category: string;
  image: string;
  currencies: string[];
  denominations: number[];
  cardTypes: SogoCardType[];
  requiresPin: boolean;
  active: boolean;
};

export type SogoBillCategory =
  | "airtime"
  | "data"
  | "electricity"
  | "cable_tv"
  | "tv-subscription"
  | "electricity-bill";

export type SogoBillProvider = {
  slug: string;
  name: string;
  image?: string | null;
};

export type SogoBillCatalog = {
  airtime?: { label?: string; providers?: SogoBillProvider[] };
  data?: { label?: string; providers?: SogoBillProvider[] };
  electricity?: { label?: string; providers?: SogoBillProvider[] };
  cable_tv?: { label?: string; providers?: SogoBillProvider[] };
  [key: string]: unknown;
};

export type SogoBillPlan = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
  validity?: string | null;
  size?: string | null;
};

export type SogoBillPurchaseData = {
  reference?: string;
  status?: string;
  type?: string;
  network?: string;
  phone?: string;
  amount?: number;
  fee?: number;
  total?: number;
  token?: string | null;
  prepaid_token?: string | null;
  token_code?: string | null;
  created_at?: string;
  [key: string]: unknown;
};

export type SogoBillPurchaseResponse = {
  message?: string;
  data?: SogoBillPurchaseData;
};

export type SogoVerifyResult = {
  message?: string;
  verification?: {
    customer_name?: string;
    address?: string;
    meter_number?: string;
    meter_type?: string;
    smartcard_number?: string;
    current_bouquet?: string;
    renewal_amount?: number | string;
    [key: string]: unknown;
  };
  customer_name?: string;
  [key: string]: unknown;
};
