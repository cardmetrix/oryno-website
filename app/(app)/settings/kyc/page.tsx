"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  Clock3,
  FileImage,
  Loader2,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app/app-shell";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { Skeleton } from "@/components/ui/skeleton";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";

type Submission = {
  id: string;
  step: number;
  idType: string | null;
  idNumber: string | null;
  idFrontUrl: string | null;
  idBackUrl: string | null;
  selfieUrl: string | null;
  status: string;
  rejectionReason: string | null;
  submittedAt?: string | null;
  createdAt?: string | null;
};

const ID_TYPES = ["NIN Slip", "National ID", "Passport", "Driver License"];

const REVIEW_STEPS = [
  {
    key: "submitted",
    label: "Documents submitted",
    detail: "ID and selfie received securely",
  },
  {
    key: "review",
    label: "Under review",
    detail: "Our team is verifying your identity",
  },
  {
    key: "done",
    label: "Verification complete",
    detail: "You’ll get a notification when approved",
  },
] as const;

function formatSubmittedAt(iso?: string | null) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("en-NG", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function KycPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kycStatus, setKycStatus] = useState("unverified");
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [idType, setIdType] = useState("NIN Slip");
  const [idNumber, setIdNumber] = useState("");
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<
    "front" | "back" | "selfie" | null
  >(null);

  const step = useMemo(() => {
    if (kycStatus === "verified" || kycStatus === "pending") return 4;
    if (selfieUrl) return 3;
    if (idFrontUrl && idNumber) return 2;
    return 1;
  }, [kycStatus, selfieUrl, idFrontUrl, idNumber]);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/kyc", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setKycStatus(json.kycStatus);
      setSubmission(json.submission);
      if (json.submission) {
        setIdType(json.submission.idType || "NIN Slip");
        setIdNumber(json.submission.idNumber || "");
        setIdFrontUrl(json.submission.idFrontUrl);
        setIdBackUrl(json.submission.idBackUrl);
        setSelfieUrl(json.submission.selfieUrl);
      }
    } catch {
      toast.error("Could not load KYC status");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const { startUpload, isUploading } = useUploadThing("kycDocument", {
    onClientUploadComplete: (res) => {
      const url = res?.[0]?.ufsUrl || res?.[0]?.url;
      if (!url || !uploadTarget) return;
      if (uploadTarget === "front") setIdFrontUrl(url);
      if (uploadTarget === "back") setIdBackUrl(url);
      if (uploadTarget === "selfie") setSelfieUrl(url);
      setUploadTarget(null);
      toast.success("Document uploaded");
    },
    onUploadError: (err) => {
      setUploadTarget(null);
      toast.error(err.message || "Upload failed");
    },
  });

  function pickFile(target: "front" | "back" | "selfie") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setUploadTarget(target);
      void startUpload([file]);
    };
    input.click();
  }

  async function saveProgress(submit = false) {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idType,
          idNumber,
          idFrontUrl,
          idBackUrl,
          selfieUrl,
          step,
          submit,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setKycStatus(json.kycStatus);
      setSubmission(json.submission);
      toast.success(submit ? "KYC submitted for review" : "Progress saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const locked = kycStatus === "verified" || kycStatus === "pending";
  const submittedLabel = formatSubmittedAt(
    submission?.submittedAt || submission?.createdAt,
  );

  return (
    <AppShell>
      <PageHeader
        title="KYC Verification"
        subtitle={
          kycStatus === "verified"
            ? "Your identity is verified"
            : kycStatus === "pending"
              ? "Pending verification"
              : `Step ${Math.min(step, 3)} of 3`
        }
        backHref="/settings"
      />

      {loading ? (
        <MotionSection className="space-y-4 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-40 w-full rounded-[22px]" />
          <Skeleton className="h-11 w-full rounded-[14px]" />
        </MotionSection>
      ) : kycStatus === "pending" ? (
        <PendingVerificationView
          submission={submission}
          submittedLabel={submittedLabel}
        />
      ) : (
        <>
          <MotionSection className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{
                  width:
                    kycStatus === "verified"
                      ? "100%"
                      : `${(Math.min(step, 3) / 3) * 100}%`,
                }}
                className="h-full rounded-full bg-gradient-to-r from-[#ff8124] via-oryno-orange to-[#e85d00]"
              />
            </div>

            {kycStatus === "verified" ? (
              <StatusCard
                icon={BadgeCheck}
                title="Verified"
                body="You have full access to ORYNO limits and payouts."
                tone="success"
              />
            ) : kycStatus === "rejected" ? (
              <StatusCard
                icon={ShieldAlert}
                title="Rejected"
                body={
                  submission?.rejectionReason ||
                  "Please update your documents and resubmit."
                }
                tone="error"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete ID upload and selfie to unlock higher wallet limits.
              </p>
            )}
          </MotionSection>

          {!locked ? (
            <MotionSection
              delay={0.06}
              className="mt-4 space-y-4 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
            >
              <AuthField label="ID Type">
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className={authInputClassName}
                >
                  {ID_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </AuthField>

              <AuthField label="ID Number">
                <input
                  value={idNumber}
                  onChange={(e) => setIdNumber(e.target.value)}
                  placeholder="e.g. 12345678901"
                  className={authInputClassName}
                />
              </AuthField>

              <UploadTile
                label="ID Front"
                url={idFrontUrl}
                uploading={isUploading && uploadTarget === "front"}
                onClick={() => pickFile("front")}
              />
              <UploadTile
                label="ID Back (optional)"
                url={idBackUrl}
                uploading={isUploading && uploadTarget === "back"}
                onClick={() => pickFile("back")}
              />
              <UploadTile
                label="Selfie"
                url={selfieUrl}
                uploading={isUploading && uploadTarget === "selfie"}
                onClick={() => pickFile("selfie")}
                selfie
              />

              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveProgress(false)}
                  className="btn-secondary h-11 text-sm disabled:opacity-60"
                >
                  Save draft
                </button>
                <button
                  type="button"
                  disabled={saving || !idFrontUrl || !idNumber}
                  onClick={() => void saveProgress(true)}
                  className="btn-primary inline-flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Submit KYC
                </button>
              </div>
            </MotionSection>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

function PendingVerificationView({
  submission,
  submittedLabel,
}: {
  submission: Submission | null;
  submittedLabel: string | null;
}) {
  const docs = [
    { label: "ID front", url: submission?.idFrontUrl },
    { label: "ID back", url: submission?.idBackUrl },
    { label: "Selfie", url: submission?.selfieUrl },
  ].filter((d) => d.url);

  return (
    <div className="space-y-4">
      <MotionSection className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#c94a00] px-5 pb-8 pt-7 text-white">
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/15"
            animate={{ scale: [1, 1.12, 1], opacity: [0.35, 0.55, 0.35] }}
            transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="pointer-events-none absolute -bottom-16 left-8 h-36 w-36 rounded-full bg-black/10"
            animate={{ scale: [1, 1.08, 1] }}
            transition={{ duration: 5.5, repeat: Infinity, ease: "easeInOut" }}
          />

          <div className="relative flex flex-col items-center text-center">
            <div className="relative mb-4">
              <motion.span
                className="absolute inset-0 rounded-full bg-white/25"
                animate={{ scale: [1, 1.45, 1], opacity: [0.55, 0, 0.55] }}
                transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
              />
              <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/35 backdrop-blur-sm">
                <ShieldCheck className="h-8 w-8" strokeWidth={1.75} />
              </span>
            </div>

            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">
              Pending verification
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              We’re reviewing your KYC
            </h2>
            <p className="mt-2 max-w-sm text-sm text-white/85">
              Your documents are in the review queue. You’ll get an in-app
              notification as soon as a decision is made.
            </p>

            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-black/15 px-3.5 py-2 text-xs font-semibold ring-1 ring-white/20 backdrop-blur-sm">
              <Clock3 className="h-3.5 w-3.5" />
              Usually takes a few hours
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5">
          <div className="grid grid-cols-2 gap-2.5">
            <div className="rounded-2xl border border-border bg-muted/40 px-3.5 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">
                Submitted
              </p>
              <p className="mt-1 text-sm font-semibold text-foreground">
                {submittedLabel || "Just now"}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-muted/40 px-3.5 py-3">
              <p className="text-[11px] font-medium text-muted-foreground">
                ID type
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {submission?.idType || "—"}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
              Review progress
            </p>
            <ol className="space-y-0">
              {REVIEW_STEPS.map((item, index) => {
                const done = index === 0;
                const active = index === 1;
                const upcoming = index === 2;
                return (
                  <li key={item.key} className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className={cn(
                          "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold",
                          done && "bg-[var(--oryno-success)] text-white",
                          active &&
                            "bg-oryno-orange-muted text-primary ring-2 ring-primary/25",
                          upcoming && "bg-muted text-muted-foreground",
                        )}
                      >
                        {done ? (
                          <CheckCircle2 className="h-4 w-4" />
                        ) : active ? (
                          <motion.span
                            className="h-2.5 w-2.5 rounded-full bg-primary"
                            animate={{ scale: [1, 1.35, 1], opacity: [1, 0.65, 1] }}
                            transition={{
                              duration: 1.4,
                              repeat: Infinity,
                              ease: "easeInOut",
                            }}
                          />
                        ) : (
                          index + 1
                        )}
                      </span>
                      {index < REVIEW_STEPS.length - 1 ? (
                        <span
                          className={cn(
                            "my-1 w-0.5 flex-1 min-h-6 rounded-full",
                            done ? "bg-[var(--oryno-success)]" : "bg-border",
                          )}
                        />
                      ) : null}
                    </div>
                    <div className={cn("pb-5", index === REVIEW_STEPS.length - 1 && "pb-0")}>
                      <p
                        className={cn(
                          "text-sm font-semibold",
                          upcoming ? "text-muted-foreground" : "text-foreground",
                        )}
                      >
                        {item.label}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {docs.length ? (
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Submitted documents
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                {docs.map((doc) => (
                  <div
                    key={doc.label}
                    className="overflow-hidden rounded-2xl border border-border bg-muted/30"
                  >
                    <div className="relative aspect-square">
                      <Image
                        src={doc.url!}
                        alt={doc.label}
                        fill
                        className="object-cover"
                        sizes="120px"
                      />
                    </div>
                    <p className="truncate px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
                      {doc.label}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-dashed border-primary/25 bg-oryno-orange-muted/50 px-4 py-3.5">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-primary">
                <Clock3 className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  We’ll notify you
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Check Notifications for the verification result. No need to
                  resubmit while review is in progress.
                </p>
              </div>
            </div>
          </div>
        </div>
      </MotionSection>
    </div>
  );
}

function StatusCard({
  icon: Icon,
  title,
  body,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  body: string;
  tone: "success" | "pending" | "error";
}) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-[18px] p-4",
        tone === "success" && "bg-oryno-success/10 text-oryno-success",
        tone === "pending" && "bg-oryno-orange-muted text-primary",
        tone === "error" && "bg-destructive/10 text-destructive",
      )}
    >
      <Icon className="mt-0.5 h-5 w-5 shrink-0" />
      <div>
        <p className="text-sm font-bold">{title}</p>
        <p className="mt-1 text-xs opacity-90">{body}</p>
      </div>
    </div>
  );
}

function UploadTile({
  label,
  url,
  uploading,
  onClick,
  selfie,
}: {
  label: string;
  url: string | null;
  uploading?: boolean;
  onClick: () => void;
  selfie?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[18px] border border-dashed border-border bg-muted/30 p-3 text-left transition hover:border-primary/40 hover:bg-oryno-orange-muted/40"
    >
      <div className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-background">
        {url ? (
          <Image src={url} alt={label} fill className="object-cover" />
        ) : selfie ? (
          <Camera className="h-5 w-5 text-muted-foreground" />
        ) : (
          <FileImage className="h-5 w-5 text-muted-foreground" />
        )}
        {uploading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Loader2 className="h-4 w-4 animate-spin text-white" />
          </div>
        ) : null}
      </div>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-muted-foreground">
          {url ? "Tap to replace" : "Tap to upload"}
        </p>
      </div>
    </button>
  );
}
