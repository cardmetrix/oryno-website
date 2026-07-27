export type VtpassServiceCategory =
  | "airtime"
  | "data"
  | "tv-subscription"
  | "electricity-bill";

export type VtpassService = {
  serviceID: string;
  name: string;
  minimium_amount?: string;
  maximum_amount?: string;
  convinience_fee?: string;
  product_type?: string;
  image?: string;
};

export type VtpassVariation = {
  variation_code: string;
  name: string;
  variation_amount: string;
  fixedPrice?: string;
  charged_amount?: string | number;
  variation_rate?: string | number;
};

export type VtpassPayPayload = {
  request_id: string;
  serviceID: string;
  amount?: number | string;
  phone: string;
  billersCode?: string;
  variation_code?: string;
  subscription_type?: string;
  quantity?: number | string;
  type?: string;
  operator_id?: string | number;
  country_code?: string;
  product_type_id?: string | number;
  email?: string;
};

export type VtpassTransaction = {
  status?: string;
  product_name?: string;
  unique_element?: string;
  unit_price?: string | number;
  quantity?: number;
  commission?: number;
  total_amount?: number;
  type?: string;
  email?: string;
  phone?: string;
  amount?: string | number;
  transactionId?: string;
  convinience_fee?: number;
};

export type VtpassPayResponse = {
  code?: string;
  response_description?: string;
  requestId?: string;
  amount?: number | string;
  purchased_code?: string;
  transaction_date?: string;
  content?: {
    transactions?: VtpassTransaction;
  };
  // International extras
  CountryCode?: string;
  Amount?: string;
};

export type VtpassIntlCountry = {
  code: string;
  flag: string;
  name: string;
  currency: string;
  prefix: string;
};

export type VtpassIntlProductType = {
  product_type_id: number;
  name: string;
};

export type VtpassIntlOperator = {
  operator_id: string;
  name: string;
  operator_image?: string;
};

export type VtpassVerifyResult = {
  code?: string;
  content?: Record<string, unknown>;
  Customer_Name?: string;
  Customer_Number?: string;
  Meter_Number?: string;
  Address?: string;
  MeterNumber?: string;
  Customer_ID?: string;
  Current_Bouquet?: string;
  Current_Bouquet_Code?: string;
  Renewal_Amount?: number | string;
  Min_Purchase_Amount?: number | string;
  Customer_Type?: string;
  WrongBillersCode?: boolean;
};
