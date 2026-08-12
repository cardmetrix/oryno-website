"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ImagePlus, RotateCcw, Upload } from "lucide-react";
import { toast } from "sonner";
import { AdminCard } from "@/components/admin/admin-card";
import {
  AdminEmptyBlock,
  AdminErrorBlock,
  AdminLoadingBlock,
} from "@/components/admin/admin-loading";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { UploadButton } from "@/components/ui/upload-button";
import { useAdminQuery } from "@/lib/admin/use-admin-query";
import { cn } from "@/lib/utils";

type Asset = {
  id: string;
  slot: string;
  label: string;
  description: string | null;
  imageUrl: string;
  imageUrlAbsolute: string;
  defaultPath: string;
  defaultUrl: string;
  group: string;
  sortOrder: number;
  isCustom: boolean;
  updatedAt: string;
};

type Response = { assets: Asset[] };

export default function AdminLandingPage() {
  const { data, loading, error, reload } =
    useAdminQuery<Response>("/api/admin/landing");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "auth" | "landing">("all");

  const assets = useMemo(() => {
    const rows = data?.assets ?? [];
    if (filter === "all") return rows;
    return rows.filter((a) => a.group === filter);
  }, [data?.assets, filter]);

  async function saveImage(asset: Asset, imageUrl: string) {
    setBusyId(asset.id);
    try {
      const res = await fetch(`/api/admin/landing/${asset.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageUrl }),
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Update failed");
      toast.success("Image updated", { description: asset.label });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  }

  async function resetAsset(asset: Asset) {
    if (
      !window.confirm(
        `Reset “${asset.label}” to the default bundled image?\n${asset.defaultPath}`,
      )
    ) {
      return;
    }
    setBusyId(asset.id);
    try {
      const res = await fetch(`/api/admin/landing/${asset.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(json.error || "Reset failed");
      toast.success("Reset to default", { description: asset.label });
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-5">
      <AdminPageHeader
        title="Landing & Auth images"
        subtitle="Upload or replace website landing screenshots and the login-screen panel image. Current public files are the defaults — reset anytime."
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["all", "All"],
            ["auth", "Login / Auth"],
            ["landing", "Landing page"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={cn(
              "h-9 rounded-full px-3.5 text-xs font-semibold transition",
              filter === value
                ? "bg-primary text-white"
                : "border border-border bg-background text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <AdminLoadingBlock />
      ) : error ? (
        <AdminErrorBlock message={error} onRetry={() => void reload()} />
      ) : !assets.length ? (
        <AdminEmptyBlock message="No landing assets yet." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {assets.map((asset) => {
            const busy = busyId === asset.id;
            return (
              <AdminCard key={asset.id} className="overflow-hidden p-0">
                <div className="relative aspect-[4/5] bg-muted">
                  <Image
                    src={asset.imageUrl}
                    alt={asset.label}
                    fill
                    unoptimized={/^https?:\/\//i.test(asset.imageUrl)}
                    className={cn(
                      "object-cover",
                      asset.group === "auth" && "object-center",
                    )}
                    sizes="(max-width: 640px) 100vw, 33vw"
                  />
                  <span
                    className={cn(
                      "absolute left-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-bold text-white",
                      asset.isCustom ? "bg-emerald-600" : "bg-black/60",
                    )}
                  >
                    {asset.isCustom ? "Custom" : "Default"}
                  </span>
                  <span className="absolute right-3 top-3 rounded-full bg-black/60 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    {asset.group}
                  </span>
                </div>
                <div className="space-y-3 p-4">
                  <div>
                    <p className="text-sm font-bold text-foreground">
                      {asset.label}
                    </p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      {asset.description}
                    </p>
                    <p className="mt-2 truncate font-mono text-[10px] text-muted-foreground">
                      {asset.slot} · {asset.defaultPath}
                    </p>
                  </div>

                  <div className="flex flex-col gap-2">
                    <UploadButton
                      endpoint="adImage"
                      onClientUploadComplete={(files) => {
                        const url = files?.[0]?.url;
                        if (!url) {
                          toast.error("Upload finished without a URL");
                          return;
                        }
                        void saveImage(asset, url);
                      }}
                      onUploadError={(err) => {
                        toast.error(err.message || "Upload failed");
                      }}
                      className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-background text-xs font-semibold text-foreground disabled:opacity-60"
                    >
                      <ImagePlus className="h-4 w-4" />
                      {busy ? "Saving…" : "Upload / replace"}
                    </UploadButton>

                    <button
                      type="button"
                      disabled={busy || !asset.isCustom}
                      onClick={() => void resetAsset(asset)}
                      className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-muted/40 text-xs font-semibold text-foreground disabled:opacity-50"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Reset to default
                    </button>
                  </div>
                </div>
              </AdminCard>
            );
          })}
        </div>
      )}

      <AdminCard className="flex items-start gap-3 p-4 text-sm text-muted-foreground">
        <Upload className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
        <p>
          Uploads use the same secure image pipeline as Ads & Onboarding.
          Reset restores the original file under{" "}
          <span className="font-mono text-foreground">/public/screenshots</span>{" "}
          or{" "}
          <span className="font-mono text-foreground">/public/brand</span>.
        </p>
      </AdminCard>
    </div>
  );
}
