export type BettingVerifyResult = {
  ok: boolean;
  demo: boolean;
  customerName: string | null;
  customerId: string;
  provider: string;
  providerName: string;
  message?: string;
};

export type BettingFundResult = {
  status: "completed" | "processing" | "failed";
  simulated: boolean;
  wallet: {
    id: string;
    currency: string;
    balance: string;
    balanceFormatted: string;
    status: string;
    isPrimary: boolean;
  };
  orderId: string;
  transactionId: string;
  requestId: string;
  amount: number;
  customerName: string | null;
  token: string | null;
};
