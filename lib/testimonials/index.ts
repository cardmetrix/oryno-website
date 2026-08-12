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
