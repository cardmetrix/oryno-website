export type KenyaBillCategory = "tv" | "electricity" | "water";

export type KenyaBillService = {
  serviceID: string;
  name: string;
  category: KenyaBillCategory;
  domain: string;
  image: string;
  customerLabel: string;
  minAmount: number;
  maxAmount: number;
  popular?: boolean;
  match: string[];
};

export type KenyaBillPlan = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
  billerId?: number | null;
};

export type ReloadlyUtilityBiller = {
  id: number;
  name: string;
  countryIsoCode?: string;
  countryCode?: string;
  type?: string;
  serviceType?: string;
  minLocalTransactionAmount?: number;
  maxLocalTransactionAmount?: number;
  localTransactionCurrencyCode?: string;
};

export type ReloadlyPayResponse = {
  id?: number;
  status?: string;
  referenceId?: string;
  code?: string;
  message?: string;
  pinDetail?: { serial?: string; pin?: string; info1?: string };
  additionalInfo?: Record<string, unknown>;
};

export type KenyaBillVerifyResult = {
  ok: boolean;
  demo: boolean;
  customerName: string | null;
  customerAddress?: string | null;
  renewalAmount?: number | null;
  currentBouquet?: string | null;
  message?: string;
};

export type KenyaBillPayResult = {
  ok: boolean;
  demo: boolean;
  pending: boolean;
  reference: string;
  transactionId: string | null;
  token: string | null;
  message?: string;
  raw?: Record<string, unknown>;
};
