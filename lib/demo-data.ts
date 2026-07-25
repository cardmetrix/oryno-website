import type { Transaction } from "@/components/app/transaction-row";

export const recentTransactions: Transaction[] = [
  {
    id: "1",
    title: "MTN Airtime purchase",
    subtitle: "Bought airtime for 0803••••222",
    amount: "-₦2,000.00",
    type: "debit",
    status: "Completed",
  },
  {
    id: "2",
    title: "Received from Sarah",
    subtitle: "Kuda peer transfer",
    amount: "+₦15,000.00",
    type: "credit",
    status: "Completed",
  },
  {
    id: "3",
    title: "Netflix Subscription",
    subtitle: "USD virtual debit",
    amount: "-₦5,400.00",
    type: "debit",
    status: "Completed",
  },
];

export const walletHistory: Transaction[] = [
  {
    id: "w1",
    title: "Funded via card",
    subtitle: "Card ending 4059",
    amount: "+₦50,000.00",
    type: "credit",
    status: "Completed",
  },
  {
    id: "w2",
    title: "Gift Card Purchased",
    subtitle: "Apple Gift Card (US)",
    amount: "-₦38,500.00",
    type: "debit",
    status: "Completed",
  },
  {
    id: "w3",
    title: "DSTV Premium",
    subtitle: "Bill payment",
    amount: "-₦24,600.00",
    type: "debit",
    status: "Completed",
  },
  {
    id: "w4",
    title: "Interbank payout",
    subtitle: "Withdraw to Kuda",
    amount: "-₦20,000.00",
    type: "debit",
    status: "Completed",
  },
];

export const historyGroups = [
  {
    date: "TODAY, OCT 24",
    items: [
      {
        id: "h1",
        title: "Data Bundle Transfer",
        subtitle: "MTN Daily plan",
        amount: "-₦3,000.00",
        type: "debit" as const,
        status: "Completed" as const,
      },
      {
        id: "h2",
        title: "Kuda peer receive",
        subtitle: "Sarah funding checkout",
        amount: "+₦15,000.00",
        type: "credit" as const,
        status: "Completed" as const,
      },
      {
        id: "h3",
        title: "Fund Wallet Checkout",
        subtitle: "Card end in 4059",
        amount: "+₦50,000.00",
        type: "credit" as const,
        status: "Completed" as const,
      },
    ],
  },
  {
    date: "YESTERDAY, OCT 23",
    items: [
      {
        id: "h4",
        title: "Netflix premium",
        subtitle: "USD virtual debit auto",
        amount: "-₦5,400.00",
        type: "debit" as const,
        status: "Completed" as const,
      },
      {
        id: "h5",
        title: "Ikeja electric bill",
        subtitle: "Token generation utility",
        amount: "-₦12,000.00",
        type: "debit" as const,
        status: "Failed" as const,
      },
      {
        id: "h6",
        title: "Swiggy deliver food",
        subtitle: "Benson treat lunch",
        amount: "-₦4,500.00",
        type: "debit" as const,
        status: "Pending" as const,
      },
    ],
  },
];
