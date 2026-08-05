"use client";

import { FormEvent, useMemo, useState } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  Archive,
  ImagePlus,
  Pencil,
  Plus,
  Trash2,
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
import { UploadButton } from "@/components/ui/upload-button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AD_PLACEMENT_OPTIONS,
  AD_STATUS_OPTIONS,
  DEFAULT_OVERLAY,
  type AdPlacement,
  type AdStatus,
} from "@/lib/admin/ads";
import { useAdminQuery } from "@/lib/admin/use-admin-query";
import { cn } from "@/lib/utils";

type Ad = {
  id: string;
  title: string;
  subtitle: string | null;
  imageUrl: string;
  href: string;
  badge: string | null;
  overlay: string;
  overlayColors: string[];
  placement: AdPlacement;
  status: AdStatus;
  statusLabel: string;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  expired: boolean;
  scheduled: boolean;
  active: boolean;
};

type Response = {
  ads: Ad[];
  statusOptions: typeof AD_STATUS_OPTIONS;
  placementOptions: typeof AD_PLACEMENT_OPTIONS;
};

type FormState = {
  title: string;
  subtitle: string;
  href: string;
  badge: string;
  imageUrl: string;
  placement: AdPlacement;
  status: AdStatus;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
  overlay: string;
};

const emptyForm = (): FormState => ({
  title: "",
  subtitle: "",
  href: "/services/gift-cards",
  badge: "",
  imageUrl: "",
  placement: "home_carousel",
  status: "live",
  sortOrder: "0",
  startsAt: "",
  endsAt: "",
  overlay: DEFAULT_OVERLAY,
});

function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AdminAdsPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/ads");
  const [filter, setFilter] = useState<"" | AdStatus>("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Ad | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const statusOptions = data?.statusOptions?.length
    ? data.statusOptions
    : AD_STATUS_OPTIONS;

  const ads = useMemo(() => {
    const rows = data?.ads ?? [];
    if (!filter) return rows;
    return rows.filter((a) => a.status === filter);
  }, [data?.ads, filter]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  }

  function openEdit(ad: Ad) {
    setEditing(ad);
    setForm({
      title: ad.title,
      subtitle: ad.subtitle || "",
      href: ad.href,
      badge: ad.badge || "",
      imageUrl: ad.imageUrl,
      placement: ad.placement,
      status: ad.status,
      sortOrder: String(ad.sortOrder),
      startsAt: toLocalInput(ad.startsAt),
      endsAt: toLocalInput(ad.endsAt),
      overlay: ad.overlay || DEFAULT_OVERLAY,
    });
    setOpen(true);
  }

  async function onSave(e: FormEvent) {
    e.preventDefault();
    if (!form.imageUrl.trim()) {
      toast.error("Upload an ad image first");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: form.title.trim(),
        subtitle: form.subtitle.trim() || null,
        href: form.href.trim(),
        badge: form.badge.trim() || null,
        imageUrl: form.imageUrl.trim(),
        placement: form.placement,
        status: form.status,
        sortOrder: Number(form.sortOrder) || 0,
        startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : null,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
        overlay: form.overlay.trim() || DEFAULT_OVERLAY,
      };

      const url = editing ? `/api/admin/ads/${editing.id}` : "/api/admin/ads";
      const res = await fetch(url, {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save ad");
      toast.success(editing ? "Ad updated" : "Ad created");
      setOpen(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save ad");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(ad: Ad, status: AdStatus) {
    setBusyId(ad.id);
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to update");
      toast.success(`${ad.title} → ${json.ad?.statusLabel || status}`);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(ad: Ad) {
    if (!window.confirm(`Delete “${ad.title}”? This cannot be undone.`)) return;
    setBusyId(ad.id);
    try {
      const res = await fetch(`/api/admin/ads/${ad.id}`, { method: "DELETE" });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Failed to delete");
      toast.success("Ad deleted");
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
        title="Ads"
        subtitle="Home carousel creatives with schedule, archive, and expiry"
        actions={
          <motion.button
            type="button"
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            onClick={openCreate}
            className="btn-primary inline-flex h-11 items-center gap-1.5 px-4 text-sm"
          >
            <Plus className="h-4 w-4" />
            Add ad
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
          ads.length === 0 ? (
            <AdminEmptyBlock message="No ads yet. Create your first carousel slide." />
          ) : (
            <div className="grid gap-3 lg:grid-cols-2">
              {ads.map((ad, index) => (
                <motion.div
                  key={ad.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(index * 0.03, 0.3) }}
                  className="overflow-hidden rounded-[18px] border border-border bg-muted/40"
                >
                  <div className="relative h-36 bg-muted">
                    <Image
                      src={ad.imageUrl}
                      alt={ad.title}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      unoptimized
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/10" />
                    <div className="absolute right-3 top-3">
                      <StatusBadge status={ad.statusLabel} />
                    </div>
                    {ad.expired ? (
                      <span className="absolute left-3 top-3 rounded-full bg-destructive px-2 py-0.5 text-[10px] font-bold text-white">
                        Expired
                      </span>
                    ) : ad.scheduled ? (
                      <span className="absolute left-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold text-white">
                        Scheduled
                      </span>
                    ) : ad.active ? (
                      <span className="absolute left-3 top-3 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold text-white">
                        Showing
                      </span>
                    ) : null}
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="truncate text-sm font-bold text-white">
                        {ad.title}
                      </p>
                      <p className="truncate text-xs text-white/80">
                        {ad.subtitle || ad.href}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3 p-3.5">
                    <p className="text-xs text-muted-foreground">
                      Order {ad.sortOrder}
                      {ad.endsAt
                        ? ` · Expires ${new Date(ad.endsAt).toLocaleString()}`
                        : " · No expiry"}
                      {ad.badge ? ` · Badge “${ad.badge}”` : ""}
                    </p>

                    <div className="grid grid-cols-4 gap-1.5">
                      {(["live", "paused", "draft", "archived"] as AdStatus[]).map(
                        (status) => {
                          const active = ad.status === status;
                          return (
                            <button
                              key={status}
                              type="button"
                              disabled={busyId === ad.id || active}
                              onClick={() => void setStatus(ad, status)}
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
                        },
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(ad)}
                        className="btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit
                      </button>
                      <button
                        type="button"
                        disabled={busyId === ad.id || ad.status === "archived"}
                        onClick={() => void setStatus(ad, "archived")}
                        className="btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs disabled:opacity-60"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        Archive
                      </button>
                      <button
                        type="button"
                        disabled={busyId === ad.id}
                        onClick={() => void onDelete(ad)}
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
            <DialogTitle>{editing ? "Edit ad" : "Create ad"}</DialogTitle>
            <DialogDescription>
              Upload a banner image, set the link, and optionally schedule an
              expiry date.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={onSave} className="space-y-3">
            <Field label="Title">
              <input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className={inputClass}
                placeholder="Gift Cards"
              />
            </Field>
            <Field label="Subtitle">
              <input
                value={form.subtitle}
                onChange={(e) =>
                  setForm((f) => ({ ...f, subtitle: e.target.value }))
                }
                className={inputClass}
                placeholder="Sell for live Naira rates"
              />
            </Field>
            <Field label="App / web link">
              <input
                required
                value={form.href}
                onChange={(e) => setForm((f) => ({ ...f, href: e.target.value }))}
                className={inputClass}
                placeholder="/services/gift-cards"
              />
            </Field>
            <Field label="Badge (optional)">
              <input
                value={form.badge}
                onChange={(e) => setForm((f) => ({ ...f, badge: e.target.value }))}
                className={inputClass}
                placeholder="Popular"
              />
            </Field>

            <Field label="Image">
              <div className="space-y-2">
                {form.imageUrl ? (
                  <div className="relative h-32 overflow-hidden rounded-2xl border border-border">
                    <Image
                      src={form.imageUrl}
                      alt="Ad preview"
                      fill
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-border bg-muted/40 text-xs text-muted-foreground">
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
                      status: e.target.value as AdStatus,
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

            <div className="grid grid-cols-2 gap-3">
              <Field label="Starts at (optional)">
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, startsAt: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
              <Field label="Expires at (optional)">
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, endsAt: e.target.value }))
                  }
                  className={inputClass}
                />
              </Field>
            </div>

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
                {saving ? "Saving…" : editing ? "Save changes" : "Create ad"}
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
