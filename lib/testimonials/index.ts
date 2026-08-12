export const TESTIMONIAL_STATUS_OPTIONS = [
  {
    value: "pending",
    label: "Pending",
    description: "Awaiting admin approval",
  },
  {
    value: "approved",
    label: "Approved",
    description: "Visible on the landing page",
  },
  {
    value: "rejected",
    label: "Rejected",
    description: "Hidden from the landing page",
  },
] as const;

export type TestimonialStatus =
  (typeof TESTIMONIAL_STATUS_OPTIONS)[number]["value"];

export type PublicTestimonial = {
  id: string;
  authorName: string;
  authorRole: string | null;
  rating: number;
  body: string;
  featured: boolean;
  sortOrder: number;
  createdAt: string;
};

/** Seed reviews shown on the landing page when the table is empty. */
export const DEFAULT_TESTIMONIAL_REVIEWS = [
  {
    key: "ada",
    authorName: "Ada Okafor",
    authorRole: "Lagos · Gift card trader",
    rating: 5,
    body: "Sold Amazon and Apple cards and got paid into my wallet in minutes. Rates are fair and the app feels premium.",
    featured: true,
    sortOrder: 0,
  },
  {
    key: "chidi",
    authorName: "Chidi Eze",
    authorRole: "Abuja · Small business",
    rating: 5,
    body: "I fund my wallet once and pay data, electricity, and DStv without switching apps. Support actually replies.",
    featured: true,
    sortOrder: 1,
  },
  {
    key: "amina",
    authorName: "Amina Yusuf",
    authorRole: "Kano · Student",
    rating: 5,
    body: "Virtual numbers for sign-ups finally work for me. Clean UI, fast OTPs, and I can track everything in history.",
    featured: false,
    sortOrder: 2,
  },
  {
    key: "tunde",
    authorName: "Tunde Bakare",
    authorRole: "Ibadan · Freelancer",
    rating: 4,
    body: "Withdrawals hit my bank quickly and the transaction receipts look professional. Exactly what I needed for clients.",
    featured: false,
    sortOrder: 3,
  },
  {
    key: "nneka",
    authorName: "Nneka Okoro",
    authorRole: "Port Harcourt · Reseller",
    rating: 5,
    body: "Gift card live rates plus airtime top-up in one place changed my daily workflow. ORYNO just feels reliable.",
    featured: true,
    sortOrder: 4,
  },
  {
    key: "kwame",
    authorName: "Kwame Mensah",
    authorRole: "Accra · Digital seller",
    rating: 5,
    body: "Cross-border friendly wallet and clear pricing. Buying data for family back home is no longer a headache.",
    featured: false,
    sortOrder: 5,
  },
  {
    key: "fatima",
    authorName: "Fatima Bello",
    authorRole: "Kaduna · Parent",
    rating: 5,
    body: "Bill payments are straightforward and the confirmations give me peace of mind. My kids’ data never runs out mid-week now.",
    featured: false,
    sortOrder: 6,
  },
  {
    key: "ibrahim",
    authorName: "Ibrahim Sule",
    authorRole: "Jos · Creator",
    rating: 4,
    body: "Social boosting and virtual numbers in one wallet is underrated. The interface is smooth on both light and dark mode.",
    featured: false,
    sortOrder: 7,
  },
  {
    key: "zainab",
    authorName: "Zainab Musa",
    authorRole: "Benin City · Shop owner",
    rating: 5,
    body: "I used to juggle three apps. ORYNO handles funding, bills, and gift cards with one balance. That alone is worth it.",
    featured: false,
    sortOrder: 8,
  },
  {
    key: "david",
    authorName: "David Nwosu",
    authorRole: "Enugu · Tech founder",
    rating: 5,
    body: "From onboarding to receipts, everything feels intentional. The product is fast, trusted, and ready for real daily use.",
    featured: true,
    sortOrder: 9,
  },
] as const;

export function isTestimonialStatus(value: string): value is TestimonialStatus {
  return TESTIMONIAL_STATUS_OPTIONS.some((option) => option.value === value);
}

export function testimonialStatusLabel(status: string) {
  return (
    TESTIMONIAL_STATUS_OPTIONS.find((option) => option.value === status)
      ?.label || status.charAt(0).toUpperCase() + status.slice(1)
  );
}

export function clampRating(value: unknown) {
  const rating = Math.round(Number(value));
  if (!Number.isFinite(rating)) return 5;
  return Math.min(5, Math.max(1, rating));
}

export function shapeTestimonialReview(row: {
  id: string;
  authorName: string;
  authorRole: string | null;
  rating: number;
  body: string;
  status: string;
  featured: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
  approvedAt?: Date | null;
}) {
  return {
    id: row.id,
    authorName: row.authorName,
    authorRole: row.authorRole,
    rating: clampRating(row.rating),
    body: row.body,
    status: row.status,
    statusLabel: testimonialStatusLabel(row.status),
    featured: row.featured,
    sortOrder: row.sortOrder,
    approved: row.status === "approved",
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    approvedAt: row.approvedAt?.toISOString() ?? null,
  };
}

export function shapePublicTestimonial(row: {
  id: string;
  authorName: string;
  authorRole: string | null;
  rating: number;
  body: string;
  featured: boolean;
  sortOrder: number;
  createdAt: Date;
}): PublicTestimonial {
  return {
    id: row.id,
    authorName: row.authorName,
    authorRole: row.authorRole,
    rating: clampRating(row.rating),
    body: row.body,
    featured: row.featured,
    sortOrder: row.sortOrder,
    createdAt: row.createdAt.toISOString(),
  };
}

export function averageRating(reviews: PublicTestimonial[]) {
  if (!reviews.length) return 0;
  const total = reviews.reduce((sum, review) => sum + review.rating, 0);
  return Math.round((total / reviews.length) * 10) / 10;
}
