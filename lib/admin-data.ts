export const adminStats = [
  { label: "Total users", value: "48,302", change: "+12.4%", up: true },
  { label: "Wallet volume (30d)", value: "₦842.6M", change: "+8.1%", up: true },
  { label: "Active countries", value: "4", change: "NG · GH · ZA · KE", up: true },
  { label: "Failed tx (24h)", value: "37", change: "-18%", up: true },
];

export const adminUsers = [
  {
    id: "u1",
    name: "Chidi Benson",
    email: "chidi@oryno.com",
    country: "Nigeria",
    status: "Active",
    kyc: "Verified",
    balance: "₦1,245,600",
  },
  {
    id: "u2",
    name: "Ama Mensah",
    email: "ama@example.com",
    country: "Ghana",
    status: "Active",
    kyc: "Pending",
    balance: "GHS 4,820",
  },
  {
    id: "u3",
    name: "Thabo Dlamini",
    email: "thabo@example.com",
    country: "South Africa",
    status: "Suspended",
    kyc: "Verified",
    balance: "ZAR 12,400",
  },
  {
    id: "u4",
    name: "Grace Wanjiku",
    email: "grace@example.com",
    country: "Kenya",
    status: "Active",
    kyc: "Unverified",
    balance: "KES 86,200",
  },
];

export const adminWallets = [
  {
    id: "w1",
    user: "Chidi Benson",
    currency: "NGN",
    balance: "₦1,245,600",
    status: "Healthy",
  },
  {
    id: "w2",
    user: "Ama Mensah",
    currency: "GHS",
    balance: "GHS 4,820",
    status: "Healthy",
  },
  {
    id: "w3",
    user: "Thabo Dlamini",
    currency: "ZAR",
    balance: "ZAR 12,400",
    status: "Frozen",
  },
];

export const giftCardRates = [
  { brand: "Amazon", buy: "₦1,480/$", sell: "₦1,350/$", status: "Live" },
  { brand: "Apple", buy: "₦1,520/$", sell: "₦1,390/$", status: "Live" },
  { brand: "Steam", buy: "₦1,410/$", sell: "₦1,280/$", status: "Paused" },
  { brand: "Netflix", buy: "₦1,450/$", sell: "₦1,320/$", status: "Soon" },
];

export const giftCardOrders = [
  {
    id: "GC-2041",
    user: "Chidi Benson",
    brand: "Amazon",
    type: "Sell",
    amount: "$100",
    status: "Processing",
  },
  {
    id: "GC-2038",
    user: "Ama Mensah",
    brand: "Apple",
    type: "Buy",
    amount: "$50",
    status: "Completed",
  },
  {
    id: "GC-2033",
    user: "Grace Wanjiku",
    brand: "Steam",
    type: "Sell",
    amount: "$75",
    status: "Failed",
  },
];

export const virtualNumberStock = [
  { country: "United States", buy: 128, rent: 420, status: "In stock" },
  { country: "United Kingdom", buy: 64, rent: 210, status: "In stock" },
  { country: "Canada", buy: 22, rent: 90, status: "Low" },
  { country: "Nigeria", buy: 0, rent: 180, status: "Buy out" },
];

export const serviceProviders = [
  {
    id: "p1",
    name: "MTN",
    type: "Airtime / Data",
    country: "Nigeria",
    status: "Active",
  },
  {
    id: "p2",
    name: "Airtel",
    type: "Airtime / Data",
    country: "Nigeria",
    status: "Active",
  },
  {
    id: "p3",
    name: "Vodacom",
    type: "Airtime / Data",
    country: "South Africa",
    status: "Active",
  },
  {
    id: "p4",
    name: "MTN Ghana",
    type: "Airtime / Data",
    country: "Ghana",
    status: "Maintenance",
  },
];

export const billProviders = [
  {
    id: "b1",
    name: "IKEDC",
    category: "Electricity",
    country: "Nigeria",
    status: "Active",
  },
  {
    id: "b2",
    name: "DStv",
    category: "TV",
    country: "Nigeria",
    status: "Active",
  },
  {
    id: "b3",
    name: "GOtv",
    category: "TV",
    country: "Nigeria",
    status: "Active",
  },
  {
    id: "b4",
    name: "ECG",
    category: "Electricity",
    country: "Ghana",
    status: "Pending",
  },
];

export const referralRows = [
  {
    code: "ORYNO-CHIDI",
    owner: "Chidi Benson",
    joins: 42,
    earnings: "₦84,000",
    status: "Active",
  },
  {
    code: "AMA-BOOST",
    owner: "Ama Mensah",
    joins: 18,
    earnings: "GHS 920",
    status: "Active",
  },
  {
    code: "THABO10",
    owner: "Thabo Dlamini",
    joins: 3,
    earnings: "ZAR 150",
    status: "Paused",
  },
];

export const adminNotifications = [
  {
    id: "an1",
    title: "Weekend data cashback",
    audience: "Nigeria users",
    status: "Scheduled",
    when: "Sat 9:00 AM",
  },
  {
    id: "an2",
    title: "Maintenance window",
    audience: "All countries",
    status: "Sent",
    when: "Yesterday",
  },
  {
    id: "an3",
    title: "Gift cards launching soon",
    audience: "Waitlist",
    status: "Draft",
    when: "—",
  },
];

export const countriesConfig = [
  {
    code: "NG",
    name: "Nigeria",
    currency: "NGN",
    services: "Wallet, Airtime, Data, Bills, Numbers, Social",
    gateway: "Paystack",
    status: "Live",
  },
  {
    code: "GH",
    name: "Ghana",
    currency: "GHS",
    services: "Wallet, Airtime, Data, Mobile Money",
    gateway: "Flutterwave",
    status: "Live",
  },
  {
    code: "ZA",
    name: "South Africa",
    currency: "ZAR",
    services: "Wallet, Airtime, Data",
    gateway: "Flutterwave",
    status: "Live",
  },
  {
    code: "KE",
    name: "Kenya",
    currency: "KES",
    services: "Wallet, Airtime, Data, Mobile Money",
    gateway: "Flutterwave",
    status: "Beta",
  },
];

export const gateways = [
  {
    id: "g1",
    name: "Paystack",
    countries: "NG",
    status: "Connected",
    mode: "Live",
  },
  {
    id: "g2",
    name: "Flutterwave",
    countries: "GH, ZA, KE",
    status: "Connected",
    mode: "Live",
  },
  {
    id: "g3",
    name: "Reserved slot",
    countries: "—",
    status: "Available",
    mode: "—",
  },
];

export const recentAdminActivity = [
  {
    id: "a1",
    title: "KYC approved for Ama Mensah",
    time: "12 min ago",
    type: "Users",
  },
  {
    id: "a2",
    title: "Steam gift card rate paused",
    time: "41 min ago",
    type: "Gift Cards",
  },
  {
    id: "a3",
    title: "Canada virtual number stock low",
    time: "2 hrs ago",
    type: "Numbers",
  },
  {
    id: "a4",
    title: "Paystack webhook healthy",
    time: "3 hrs ago",
    type: "Gateways",
  },
];
