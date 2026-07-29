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
  };
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
