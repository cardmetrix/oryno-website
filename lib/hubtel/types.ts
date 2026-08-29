export type HubtelBillCategory = "tv" | "electricity" | "water";

export type HubtelBillService = {
  serviceID: string;
  name: string;
  category: HubtelBillCategory;
  domain: string;
  image: string;
  customerLabel: string;
  minAmount: number;
  maxAmount: number;
  popular?: boolean;
};

export type HubtelBillPlan = {
  variationCode: string;
  name: string;
  amount: number;
  fixedPrice: boolean;
  hubtelServiceId?: string;
};

export type HubtelVerifyResult = {
  ok: boolean;
  demo: boolean;
  customerName: string | null;
  customerAddress?: string | null;
  renewalAmount?: number | null;
  currentBouquet?: string | null;
  message?: string;
};

export type HubtelPayResult = {
  ok: boolean;
  demo: boolean;
  pending: boolean;
  reference: string;
  transactionId: string | null;
  token: string | null;
  message?: string;
  raw?: Record<string, unknown>;
};
