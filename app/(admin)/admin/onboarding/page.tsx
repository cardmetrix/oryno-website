"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import { ImagePlus, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { UploadButton } from "@/components/ui/upload-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DEFAULT_ONBOARDING_ACCENT,
  ONBOARDING_STATUS_OPTIONS,
  type OnboardingStatus,
} from "@/lib/admin/onboarding";
import { useAdminQuery } from "@/lib/admin/use-admin-query";
import { cn } from "@/lib/utils";

type Slide = {
  id: string;
  title: string;
  subtitle: string;
  imageUrl: string;
  accent: string;
  status: OnboardingStatus;
  statusLabel: string;
  sortOrder: number;
  active: boolean;
};

type Response = {
  slides: Slide[];
  statusOptions: typeof ONBOARDING_STATUS_OPTIONS;
};

type FormState = {
  title: string;
  subtitle: string;
  imageUrl: string;
  accent: string;
  status: OnboardingStatus;
  sortOrder: string;
};

const emptyForm = (): FormState => ({
  title: "",
  subtitle: "",
  imageUrl: "",
  accent: DEFAULT_ONBOARDING_ACCENT,
  status: "live",
  sortOrder: "0",
});

export default function AdminOnboardingPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/onboarding");
  const [filter, setFilter] = useState<"" | OnboardingStatus>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Slide | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const statusOptions = data?.statusOptions?.length
    ? data.statusOptions
    : ONBOARDING_STATUS_OPTIONS;

  const slides = useMemo(() => {
    const rows = data?.slides ?? [];
    if (!filter) return rows;
    return rows.filter((s) => s.status === filter);
  }, [data?.slides, filter]);

  function openCreate() {
    setEditing(null);
    setForm({
      ...emptyForm(),
      sortOrder: String(data?.slides?.length ?? 0),
    });
    setOpen(true);
  }

  function openEdit(slide: Slide) {
    setEditing(slide);
    setForm({
      title: slide.title,
      subtitle: slide.subtitle,
      imageUrl: slide.imageUrl,
      accent: slide.accent || DEFAULT_ONBOARDING_ACCENT,
      status: slide.status,
      sortOrder: String(slide.sortOrder),
    });
    setOpen(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form.imageUrl.trim()) {
      toast.error("Upload an onboarding image first");
      return;
    }
    if (!form.subtitle.trim()) {
      toast.error("Description is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim(),
        imageUrl: form.imageUrl.trim(),
        accent: form.accent.trim() || DEFAULT_ONBOARDING_ACCENT,
        status: form.status,
        sortOrder: Number(form.sortOrder) || 0,
      };

      const url = editing
        ? `/api/admin/onboarding/${editing.id}`
        : "/api/admin/onboarding";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save slide");
      toast.success(editing ? "Slide updated" : "Slide created");
      setOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save slide");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(slide: Slide, status: OnboardingStatus) {
    setBusyId(slide.id);
    try {
      const res = await fetch(`/api/admin/onboarding/${slide.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update");
      toast.success(`${slide.title} → ${json.slide?.statusLabel || status}`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(slide: Slide) {
    if (!window.confirm(`Delete “${slide.title}”? This cannot be undone.`)) {
      return;
    }
    setBusyId(slide.id);
    try {
      const res = await fetch(`/api/admin/onboarding/${slide.id}`, {
        method: "DELETE",
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      toast.success("Slide deleted");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <>
      <AdminPageHeader
        title="App onboarding"
        subtitle="Slides shown before login — image, title, and description"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={openCreate}
            className="btn-primary inline-flex h-11 items-center gap-1.5 px-4 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add slide
          </motion.button>
        }
      />

      <div className="mb-4 flex flex-wrap gap-2">
        <FilterChip
          label="All"
          active={filter === ""}
          onClick={() => setFilter("")}
        />
        {statusOptions.map((opt) => (
          <FilterChip
            key={opt.value}
            label={opt.label}
            active={filter === opt.value}
            onClick={() => setFilter(opt.value)}
          />
        ))}
      </div>

      <AdminCard>
        {loading ? <AdminLoadingBlock variant="cards" /> : null}
        {error ? <AdminErrorBlock message={error} onRetry={reload} /> : null}
        {data ? (
          slides.length === 0 ? (
            <AdminEmptyBlock message="No onboarding slides yet. Create your first slide." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {slides.map((slide, index) => (
                <motion.div
                  key={slide.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="overflow-hidden rounded-[18px] border border-border bg-muted/40"
                >
                  <div className="relative h-44 bg-muted">
                    <Image
                      src={slide.imageUrl}
                      alt={slide.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/10" />
                    <div className="absolute right-3 top-3">
                      <StatusBadge status={slide.statusLabel} />
                    </div>
                    {slide.active ? (
                      <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Showing
                      </span>
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="truncate text-sm font-bold text-white">
                        {slide.title}
                      </p>
                      <p className="line-clamp-2 text-xs text-white/80">
                        {slide.subtitle}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 p-3.5">
                    <p className="text-xs text-muted-foreground">
                      Order {slide.sortOrder}
                      {slide.accent ? ` · Accent ${slide.accent}` : ""}
                    </p>

                    <div className="grid grid-cols-4 gap-1.5">
                      {(
                        ["live", "paused", "draft", "archived"] as OnboardingStatus[]
                      ).map((status) => {
                        const active = slide.status === status;
                        return (
                          <button
                            key={status}
                            type="button"
                            disabled={busyId === slide.id || active}
                            onClick={() => void setStatus(slide, status)}
                            className={cn(
                              "h-9 rounded-xl text-[10px] font-semibold capitalize transition sm:text-[11px]",
                              active
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground",
                              "disabled:opacity-60",
                            )}
                          >
                            {status}
                          </button>
                        );
                      })}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(slide)}
                        className="btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === slide.id}
                        onClick={() => void onDelete(slide)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-destructive/30 bg-destructive/10 px-3 text-xs font-semibold text-destructive disabled:opacity-60"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        Delete
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )
        ) : null}
      </AdminCard>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing ? "Edit onboarding slide" : "Create onboarding slide"}
            </DialogTitle>
            <DialogDescription>
              Upload a screen image and set the title and short description shown
              in the mobile app before login.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSave} className="space-y-3">
            <Field label="Title">
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputClass}
                placeholder="Your borderless wallet"
              />
            </Field>
            <Field label="Description">
              <textarea
                required
                value={form.subtitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subtitle: e.target.value }))
                }
                className={cn(inputClass, "h-24 resize-none py-3")}
                placeholder="Fund, convert, and spend across Africa…"
              />
            </Field>

            <Field label="Image">
              <div className="space-y-2">
                {form.imageUrl ? (
                  <div className="relative h-40 overflow-hidden rounded-2xl border border-border">
                    <Image
                      src={form.imageUrl}
                      alt="Slide preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground">
                    No image yet
                  </div>
                )}
                <UploadButton
                  endpoint="adImage"
                  onClientUploadComplete={(res) => {
                    const file = res?.[0] as
                      | { url?: string; ufsUrl?: string }
                      | undefined;
                    const url = file?.ufsUrl || file?.url;
                    if (url) {
                      setForm((f) => ({ ...f, imageUrl: url }));
                      toast.success("Image uploaded");
                    }
                  }}
                  onUploadError={(err) =>
                    toast.error(err.message || "Upload failed")
                  }
                  className="btn-secondary inline-flex h-10 items-center gap-2 px-3 text-sm"
                >
                  <ImagePlus className="h-4 w-4" />
                  {form.imageUrl ? "Replace image" : "Upload image"}
                </UploadButton>
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Status">
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      status: e.target.value as OnboardingStatus,
                    }))
                  }
                  className={inputClass}
                >
                  {statusOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Sort order">
                <input
                  type="number"
                  min={0}
                  value={form.sortOrder}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, sortOrder: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
            </div>

            <Field label="Accent color (optional)">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={
                    /^#([0-9a-fA-F]{6})$/.test(form.accent)
                      ? form.accent
                      : DEFAULT_ONBOARDING_ACCENT
                  }
                  onChange={(e) =>
                    setForm((f) => ({ ...f, accent: e.target.value }))
                  }
                  className="h-11 w-14 cursor-pointer rounded-xl border border-border bg-background p-1"
                />
                <input
                  value={form.accent}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, accent: e.target.value }))
                  }
                  className={inputClass}
                  placeholder="#FF6A00"
                />
              </div>
            </Field>

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
                {saving
                  ? "Saving…"
                  : editing
                    ? "Save changes"
                    : "Create slide"}
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
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
