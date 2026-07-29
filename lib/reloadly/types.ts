export type ReloadlyProduct = {
  productId: number;
  productName: string;
  global: boolean;
  status?: string;
  supportsPreOrder?: boolean;
  senderCurrencyCode?: string;
  senderFee?: number;
  discountPercentage?: number;
  denominationType: "FIXED" | "RANGE" | string;
  recipientCurrencyCode: string;
  minRecipientDenomination?: number | null;
  maxRecipientDenomination?: number | null;
  fixedRecipientDenominations?: number[] | null;
  fixedRecipientToSenderDenominationsMap?: Record<string, number> | null;
  logoUrls?: string[];
  brand?: { brandId: number; brandName: string };
  country?: { isoName?: string; name?: string; currencyCode?: string };
  redeemInstruction?: { concise?: string; verbose?: string };
};

export type ReloadlyProductsPage = {
  content?: ReloadlyProduct[];
  totalElements?: number;
  totalPages?: number;
  number?: number;
  size?: number;
};

export type ReloadlyOrderResponse = {
  transactionId: number;
  amount: number;
  discount?: number;
  currencyCode: string;
  fee?: number;
  recipientEmail?: string;
  customIdentifier?: string;
  status: string;
  product?: {
    productId: number;
    productName: string;
    countryCode?: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    currencyCode: string;
    brand?: { brandId: number; brandName: string };
  };
};

export type ReloadlyCardCode = {
  cardNumber?: string | number;
  pinCode?: string | null;
  amount?: number;
};

export type BuyProductView = {
  productId: number;
  name: string;
  brandName: string;
  countryCode: string;
  image: string;
  denominationType: "FIXED" | "RANGE" | string;
  recipientCurrency: string;
  denominations: number[];
  minAmount: number | null;
  maxAmount: number | null;
  /** Map recipient face value → approximate sender/charge amount (provider currency or USD) */
  senderPriceMap: Record<string, number>;
  redeemHint: string | null;
};
