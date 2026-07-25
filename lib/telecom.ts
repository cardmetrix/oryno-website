export type NetworkId = "mtn" | "airtel" | "glo" | "9mobile";

export type Network = {
  id: NetworkId;
  name: string;
  color: string;
  soft: string;
};

export const networks: Network[] = [
  {
    id: "mtn",
    name: "MTN",
    color: "#FFCC00",
    soft: "rgba(255, 204, 0, 0.16)",
  },
  {
    id: "airtel",
    name: "Airtel",
    color: "#ED1C24",
    soft: "rgba(237, 28, 36, 0.14)",
  },
  {
    id: "glo",
    name: "Glo",
    color: "#50B848",
    soft: "rgba(80, 184, 72, 0.14)",
  },
  {
    id: "9mobile",
    name: "9mobile",
    color: "#006F2D",
    soft: "rgba(0, 111, 45, 0.14)",
  },
];

export const airtimePresets = ["100", "200", "500", "1000", "2000", "5000"];

export type DataPlan = {
  id: string;
  network: NetworkId;
  name: string;
  size: string;
  validity: string;
  price: number;
  category: "Daily" | "Weekly" | "Monthly";
  popular?: boolean;
};

export const dataPlans: DataPlan[] = [
  {
    id: "mtn-d1",
    network: "mtn",
    name: "MTN Pulse",
    size: "1.5GB",
    validity: "1 day",
    price: 500,
    category: "Daily",
    popular: true,
  },
  {
    id: "mtn-d2",
    network: "mtn",
    name: "MTN Lite",
    size: "750MB",
    validity: "1 day",
    price: 300,
    category: "Daily",
  },
  {
    id: "mtn-w1",
    network: "mtn",
    name: "MTN Weekly",
    size: "6GB",
    validity: "7 days",
    price: 2500,
    category: "Weekly",
    popular: true,
  },
  {
    id: "mtn-m1",
    network: "mtn",
    name: "MTN Mega",
    size: "40GB",
    validity: "30 days",
    price: 11000,
    category: "Monthly",
  },
  {
    id: "airtel-d1",
    network: "airtel",
    name: "Airtel Smart",
    size: "1GB",
    validity: "1 day",
    price: 400,
    category: "Daily",
  },
  {
    id: "airtel-w1",
    network: "airtel",
    name: "Airtel Weekly",
    size: "5GB",
    validity: "7 days",
    price: 2000,
    category: "Weekly",
    popular: true,
  },
  {
    id: "airtel-m1",
    network: "airtel",
    name: "Airtel Max",
    size: "35GB",
    validity: "30 days",
    price: 10000,
    category: "Monthly",
  },
  {
    id: "glo-d1",
    network: "glo",
    name: "Glo Café",
    size: "2.5GB",
    validity: "1 day",
    price: 500,
    category: "Daily",
    popular: true,
  },
  {
    id: "glo-w1",
    network: "glo",
    name: "Glo Weekly",
    size: "7.5GB",
    validity: "7 days",
    price: 2000,
    category: "Weekly",
  },
  {
    id: "glo-m1",
    network: "glo",
    name: "Glo Booster",
    size: "50GB",
    validity: "30 days",
    price: 10000,
    category: "Monthly",
  },
  {
    id: "9m-d1",
    network: "9mobile",
    name: "9mobile Daily",
    size: "1GB",
    validity: "1 day",
    price: 400,
    category: "Daily",
  },
  {
    id: "9m-w1",
    network: "9mobile",
    name: "9mobile Weekly",
    size: "4.5GB",
    validity: "7 days",
    price: 2000,
    category: "Weekly",
  },
  {
    id: "9m-m1",
    network: "9mobile",
    name: "9mobile Monthly",
    size: "30GB",
    validity: "30 days",
    price: 9500,
    category: "Monthly",
    popular: true,
  },
];

export const dataCategories = ["Daily", "Weekly", "Monthly"] as const;

export function formatNaira(value: number | string) {
  const n = typeof value === "string" ? Number(value) : value;
  return `₦${Number.isFinite(n) ? n.toLocaleString("en-NG") : "0"}`;
}

export function estimateAirtimeCashback(amount: number) {
  return Math.max(5, Math.round(amount * 0.02));
}
