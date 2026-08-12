"use client";

import { FormEvent, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Check,
  Pencil,
  Plus,
  Star,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { StarRating } from "@/components/landing/star-rating";
import {
  TESTIMONIAL_STATUS_OPTIONS,
  type TestimonialStatus,
} from "@/lib/testimonials";
import { useAdminQuery } from "@/lib/admin/use-admin-query";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type Review = {
  id: string;
  authorName: string;
  authorRole: string | null;
  rating: number;
  body: string;
  status: TestimonialStatus;
  statusLabel: string;
  featured: boolean;
  sortOrder: number;
  approved: boolean;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
};

type Response = {
  reviews: Review[];
  statusOptions: typeof TESTIMONIAL_STATUS_OPTIONS;
};

type FormState = {
  authorName: string;
  authorRole: string;
  rating: number;
  body: string;
  status: TestimonialStatus;
  featured: boolean;
  sortOrder: string;
};

const emptyForm = (): FormState => ({
  authorName: "",
  authorRole: "",
  rating: 5,
  body: "",
  status: "approved",
  featured: false,
  sortOrder: "0",
});

export default function AdminTestimonialsPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/testimonials");
  const [filter, setFilter] = useState<"" | TestimonialStatus>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Review | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const statusOptions = data?.statusOptions?.length
    ? data.statusOptions
    : TESTIMONIAL_STATUS_OPTIONS;

  const reviews = useMemo(() => {
    const rows = data?.reviews ?? [];
    if (!filter) return rows;
    return rows.filter((review) => review.status === filter);
  }, [data?.reviews, filter]);

  const pendingCount =
    data?.reviews.filter((review) => review.status === "pending").length ?? 0;

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm(),
      sortOrder: String(data?.reviews?.length ?? 0),
    });
    setOpen(true);
  }

  function openEdit(review: Review) {
    setEditing(review);
    setForm({
      authorName: review.authorName,
      authorRole: review.authorRole || "",
      rating: review.rating,
      body: review.body,
      status: review.status,
      featured: review.featured,
      sortOrder: String(review.sortOrder),
    });
    setOpen(true);
  }

  async function patchReview(
    id: string,
    patch: Record<string, unknown>,
    successMessage: string,
  ) {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Update failed");
      toast.success(successMessage);
      await reload();
    } catch (updateError) {
      toast.error(
        updateError instanceof Error ? updateError.message : "Update failed",
      );
    } finally {
      setBusyId(null);
    }
  }

  async function onSave(event: FormEvent) {
    event.preventDefault();
    if (!form.authorName.trim() || !form.body.trim()) {
      toast.error("Name and review text are required");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        authorName: form.authorName.trim(),
        authorRole: form.authorRole.trim() || null,
        rating: form.rating,
        body: form.body.trim(),
        status: form.status,
        featured: form.featured,
        sortOrder: Number(form.sortOrder) || 0,
      };

      const res = await fetch(
        editing ? `/api/admin/testimonials/${editing.id}` : "/api/admin/testimonials",
        {
          method: editing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Save failed");

      toast.success(editing ? "Review updated" : "Review created");
      setOpen(false);
      await reload();
    } catch (saveError) {
      toast.error(
        saveError instanceof Error ? saveError.message : "Save failed",
      );
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(review: Review) {
    if (
      !window.confirm(
        `Delete review from ${review.authorName}? This cannot be undone.`,
      )
    ) {
      return;
    }

    setBusyId(review.id);
    try {
      const res = await fetch(`/api/admin/testimonials/${review.id}`, {
        method: "DELETE",
      });
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(payload.error || "Delete failed");
      toast.success("Review deleted");
      await reload();
    } catch (deleteError) {
      toast.error(
        deleteError instanceof Error ? deleteError.message : "Delete failed",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="Testimonials"
        description="Approve user reviews for the landing page marquee, feature highlights, or reject spam."
        actions={
          <button type="button" onClick={openCreate} className="btn-primary h-10 px-4 text-sm">
            <Plus className="mr-2 h-4 w-4" />
            Add review
          </button>
        }
      />

      <div className="mb-5 flex flex-wrap gap-2">
        <FilterChip label="All" active={filter === ""} onClick={() => setFilter("")} />
        {statusOptions.map((option) => (
          <FilterChip
            key={option.value}
            label={
              option.value === "pending" && pendingCount
                ? `${option.label} (${pendingCount})`
                : option.label
            }
            active={filter === option.value}
            onClick={() => setFilter(option.value)}
          />
        ))}
      </div>

      {loading ? <AdminLoadingBlock label="Loading reviews…" /> : null}
      {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}

      {!loading && !error && reviews.length === 0 ? (
        <AdminEmptyBlock message="No reviews yet. User submissions and manually added reviews will appear here for moderation." />
      ) : null}

      {!loading && !error && reviews.length > 0 ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {reviews.map((review) => (
            <motion.div
              key={review.id}
              layout
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <AdminCard className="h-full p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="truncate text-base font-bold text-foreground">
                        {review.authorName}
                      </h3>
                      <StatusBadge status={review.statusLabel} />
                      {review.featured ? (
                        <span className="rounded-full bg-oryno-orange-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                          Featured
                        </span>
                      ) : null}
                    </div>
                    {review.authorRole ? (
                      <p className="mt-1 text-sm text-muted-foreground">
                        {review.authorRole}
                      </p>
                    ) : null}
                  </div>
                  <StarRating value={review.rating} size="sm" />
                </div>

                <p className="mt-4 line-clamp-4 text-sm leading-relaxed text-foreground/90">
                  “{review.body}”
                </p>

                <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                  <span>Sort {review.sortOrder}</span>
                  <span>·</span>
                  <span>{new Date(review.createdAt).toLocaleString()}</span>
                </div>

                <div className="mt-5 flex flex-wrap gap-2 border-t border-border/70 pt-4">
                  {review.status === "pending" ? (
                    <>
                      <ActionButton
                        tone="success"
                        disabled={busyId === review.id}
                        onClick={() =>
                          void patchReview(review.id, { status: "approved" }, "Review approved")
                        }
                      >
                        <Check className="h-3.5 w-3.5" />
                        Approve
                      </ActionButton>
                      <ActionButton
                        tone="danger"
                        disabled={busyId === review.id}
                        onClick={() =>
                          void patchReview(review.id, { status: "rejected" }, "Review rejected")
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                        Reject
                      </ActionButton>
                    </>
                  ) : null}

                  {review.status === "approved" ? (
                    <ActionButton
                      disabled={busyId === review.id}
                      onClick={() =>
                        void patchReview(
                          review.id,
                          { featured: !review.featured },
                          review.featured ? "Removed from featured" : "Marked featured",
                        )
                      }
                    >
                      <Star className="h-3.5 w-3.5" />
                      {review.featured ? "Unfeature" : "Feature"}
                    </ActionButton>
                  ) : null}

                  <ActionButton disabled={busyId === review.id} onClick={() => openEdit(review)}>
                    <Pencil className="h-3.5 w-3.5" />
                    Edit
                  </ActionButton>

                  <ActionButton
                    tone="danger"
                    disabled={busyId === review.id}
                    onClick={() => void onDelete(review)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Delete
                  </ActionButton>
                </div>
              </AdminCard>
            </motion.div>
          ))}
        </div>
      ) : null}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit review" : "Add review"}</DialogTitle>
            <DialogDescription>
              Approved reviews appear in the landing page testimonial marquee.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSave} className="space-y-4">
            <Field label="Name">
              <input
                value={form.authorName}
                onChange={(event) =>
                  setForm((current) => ({ ...current, authorName: event.target.value }))
                }
                className={inputClass}
                required
              />
            </Field>

            <Field label="Location or role">
              <input
                value={form.authorRole}
                onChange={(event) =>
                  setForm((current) => ({ ...current, authorRole: event.target.value }))
                }
                className={inputClass}
                placeholder="Optional"
              />
            </Field>

            <Field label="Rating">
              <StarRating
                value={form.rating}
                onChange={(rating) => setForm((current) => ({ ...current, rating }))}
                size="lg"
              />
            </Field>

            <Field label="Review">
              <textarea
                value={form.body}
                onChange={(event) =>
                  setForm((current) => ({ ...current, body: event.target.value }))
                }
                rows={5}
                maxLength={600}
                className={cn(inputClass, "min-h-[120px] resize-none py-3")}
                required
              />
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      status: event.target.value as TestimonialStatus,
                    }))
                  }
                  className={inputClass}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sort order">
                <input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, sortOrder: event.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(event) =>
                  setForm((current) => ({ ...current, featured: event.target.checked }))
                }
                className="h-4 w-4 rounded border-border"
              />
              Featured in marquee
            </label>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="btn-secondary h-10 px-4 text-sm"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="btn-primary h-10 px-4 text-sm disabled:opacity-60"
              >
                {saving ? "Saving…" : editing ? "Save changes" : "Create review"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "h-9 rounded-full px-3.5 text-xs font-semibold transition",
        active
          ? "bg-foreground text-background"
          : "border border-border bg-background text-muted-foreground hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  tone = "default",
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?: "default" | "success" | "danger";
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-xs font-semibold transition disabled:opacity-50",
        tone === "default" && "border border-border bg-background hover:bg-muted/60",
        tone === "success" &&
          "border border-[color-mix(in_srgb,var(--oryno-success)_35%,white)] bg-[color-mix(in_srgb,var(--oryno-success)_12%,white)] text-[var(--oryno-success)]",
        tone === "danger" &&
          "border border-[color-mix(in_srgb,var(--oryno-error)_35%,white)] bg-[color-mix(in_srgb,var(--oryno-error)_10%,white)] text-[var(--oryno-error)]",
      )}
    >
      {children}
    </button>
  );
}

const inputClass =
  "mt-0 h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-primary";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block space-y-1.5 text-sm font-medium text-foreground">
      {label}
      {children}
    </label>
  );
}
