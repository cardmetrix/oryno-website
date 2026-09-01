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
import { KycSelfieCamera } from "@/components/app/kyc-selfie-camera";
import { MotionSection } from "@/components/app/motion-section";
import { PageHeader } from "@/components/app/page-header";
import { AuthField, authInputClassName } from "@/components/auth/auth-field";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getLevelDef,
  isBvnIdType,
  isNinIdType,
  kycRulesForSubmission,
  nextKycLevel,
  normalizeKycLevel,
  type AccountLevelId,
} from "@/lib/account-levels";
import { useUploadThing } from "@/lib/uploadthing";
import { cn } from "@/lib/utils";

type Submission = {
  id: string;
  step: number;
  targetLevel?: number;
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

const REVIEW_STEPS = [
  {
    key: "submitted",
    label: "Documents submitted",
    detail: "Your KYC package was received securely",
  },
  {
    key: "review",
    label: "Under review",
    detail: "Our team is verifying your documents",
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
  const [kycLevel, setKycLevel] = useState(0);
  const [submission, setSubmission] = useState<Submission | null>(null);
  const [idType, setIdType] = useState("NIN");
  const [idNumber, setIdNumber] = useState("");
  const [idFrontUrl, setIdFrontUrl] = useState<string | null>(null);
  const [idBackUrl, setIdBackUrl] = useState<string | null>(null);
  const [selfieUrl, setSelfieUrl] = useState<string | null>(null);
  const [uploadTarget, setUploadTarget] = useState<
    "front" | "back" | "selfie" | null
  >(null);
  const [selfieCameraOpen, setSelfieCameraOpen] = useState(false);

  const targetLevel = useMemo(() => {
    const next = nextKycLevel(kycLevel);
    if (kycStatus === "pending" && submission?.targetLevel) {
      return normalizeKycLevel(submission.targetLevel) || next || 1;
    }
    return next;
  }, [kycLevel, kycStatus, submission?.targetLevel]);

  const levelDef = targetLevel ? getLevelDef(targetLevel as AccountLevelId) : null;

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/settings/kyc", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      const level = normalizeKycLevel(json.kycLevel);
      setKycStatus(json.kycStatus);
      setKycLevel(level);
      setSubmission(json.submission);

      const next = nextKycLevel(level);
      const subLevel = normalizeKycLevel(json.submission?.targetLevel) || next || 1;
      const def = getLevelDef(
        (json.kycStatus === "pending" ? subLevel : next || 1) as AccountLevelId,
      );
      const types = def?.kyc.idTypes ?? ["NIN"];

      if (json.submission && json.kycStatus === "pending") {
        const match = types.find(
          (t) =>
            t.toLowerCase() === (json.submission.idType || "").toLowerCase(),
        );
        setIdType(match || types[0]);
        setIdNumber(json.submission.idNumber || "");
        setIdFrontUrl(json.submission.idFrontUrl);
        setIdBackUrl(json.submission.idBackUrl);
        setSelfieUrl(json.submission.selfieUrl);
      } else if (def) {
        setIdType(types[0]);
        setIdNumber("");
        setIdFrontUrl(null);
        setIdBackUrl(null);
        setSelfieUrl(null);
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

  useEffect(() => {
    if (!levelDef) return;
    if (!levelDef.kyc.idTypes.includes(idType)) {
      setIdType(levelDef.kyc.idTypes[0]);
    }
  }, [levelDef, idType]);

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

  function uploadFile(target: "front" | "back" | "selfie", file: File) {
    setUploadTarget(target);
    void startUpload([file]);
  }

  function pickFile(target: "front" | "back") {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      uploadFile(target, file);
    };
    input.click();
  }

  async function saveProgress(submit = false) {
    if (!targetLevel || !levelDef) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/kyc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetLevel,
          idType,
          idNumber,
          idFrontUrl,
          idBackUrl,
          selfieUrl,
          step: targetLevel,
          submit,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Save failed");
      setKycStatus(json.kycStatus);
      setKycLevel(normalizeKycLevel(json.kycLevel));
      setSubmission(json.submission);
      toast.success(
        submit
          ? `Level ${targetLevel} submitted for review`
          : "Progress saved",
      );
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const activeKycRules = useMemo(() => {
    if (!levelDef || !targetLevel) return null;
    return kycRulesForSubmission(targetLevel as AccountLevelId, idType);
  }, [levelDef, targetLevel, idType]);

  const locked = kycStatus === "pending" || kycLevel >= 3;
  const canSubmit = Boolean(
    activeKycRules &&
      (!activeKycRules.numberRequired || idNumber.trim()) &&
      (!activeKycRules.frontRequired || idFrontUrl) &&
      (!activeKycRules.selfieRequired || selfieUrl),
  );
  const submittedLabel = formatSubmittedAt(
    submission?.submittedAt || submission?.createdAt,
  );

  return (
    <AppShell>
      <PageHeader
        title="KYC Verification"
        subtitle={
          kycLevel >= 3
            ? "You’re fully verified (Level 3)"
            : kycStatus === "pending"
              ? `Level ${submission?.targetLevel || targetLevel} pending review`
              : targetLevel
                ? `Upgrade to Level ${targetLevel}`
                : "Verification"
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
          targetLevel={submission?.targetLevel || targetLevel || 1}
        />
      ) : (
        <>
          <MotionSection className="rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
            <div className="mb-4 h-2 overflow-hidden rounded-full bg-muted">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${(kycLevel / 3) * 100}%` }}
                className="h-full rounded-full bg-gradient-to-r from-[#ff8124] via-oryno-orange to-[#e85d00]"
              />
            </div>

            {kycLevel >= 3 ? (
              <StatusCard
                icon={BadgeCheck}
                title="Level 3 · Fully verified"
                body="Unlimited daily limit unlocked with proof of address."
                tone="success"
              />
            ) : kycStatus === "rejected" ? (
              <StatusCard
                icon={ShieldAlert}
                title="Submission rejected"
                body={
                  submission?.rejectionReason ||
                  "Please update your documents and resubmit."
                }
                tone="error"
              />
            ) : kycLevel > 0 ? (
              <StatusCard
                icon={BadgeCheck}
                title={`Level ${kycLevel} approved`}
                body={
                  levelDef
                    ? `Next: ${levelDef.requirement} for Level ${targetLevel}.`
                    : "You’re verified. Upgrade further to raise limits."
                }
                tone="success"
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {levelDef?.kyc.helpText ||
                  "Complete identity verification to unlock higher wallet limits."}
              </p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-2">
              {([1, 2, 3] as const).map((id) => (
                <div
                  key={id}
                  className={cn(
                    "rounded-xl border px-2 py-2 text-center",
                    kycLevel >= id
                      ? "border-primary/30 bg-oryno-orange-muted/50"
                      : "border-border bg-muted/40",
                  )}
                >
                  <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                    L{id}
                  </p>
                  <p className="mt-0.5 text-[11px] font-semibold text-foreground">
                    {id === 1 ? "ID / BVN" : id === 2 ? "BVN" : "Address"}
                  </p>
                </div>
              ))}
            </div>
          </MotionSection>

          {!locked && levelDef && targetLevel ? (
            <MotionSection
              delay={0.06}
              className="mt-4 space-y-4 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]"
            >
              <div>
                <p className="text-sm font-bold text-foreground">
                  Level {targetLevel} · {levelDef.shortName}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {activeKycRules?.helpText || levelDef.kyc.helpText}
                </p>
              </div>

              <AuthField label="Document type">
                <select
                  value={idType}
                  onChange={(e) => setIdType(e.target.value)}
                  className={authInputClassName}
                  disabled={levelDef.kyc.idTypes.length === 1}
                >
                  {levelDef.kyc.idTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </AuthField>

              {(activeKycRules?.numberRequired || targetLevel === 3) && (
                <AuthField label={activeKycRules?.numberLabel || "ID number"}>
                  <input
                    value={idNumber}
                    onChange={(e) =>
                      setIdNumber(
                        isBvnIdType(idType) || isNinIdType(idType)
                          ? e.target.value.replace(/\D/g, "")
                          : e.target.value,
                      )
                    }
                    placeholder={activeKycRules?.numberPlaceholder}
                    inputMode={
                      isBvnIdType(idType) || isNinIdType(idType)
                        ? "numeric"
                        : "text"
                    }
                    maxLength={
                      isBvnIdType(idType) || isNinIdType(idType) ? 11 : 64
                    }
                    className={authInputClassName}
                  />
                </AuthField>
              )}

              {(activeKycRules?.frontRequired ||
                activeKycRules?.frontLabel.includes("optional")) && (
                <UploadTile
                  label={activeKycRules.frontLabel}
                  url={idFrontUrl}
                  uploading={isUploading && uploadTarget === "front"}
                  onClick={() => pickFile("front")}
                />
              )}

              {activeKycRules?.backLabel ? (
                <UploadTile
                  label={activeKycRules.backLabel}
                  url={idBackUrl}
                  uploading={isUploading && uploadTarget === "back"}
                  onClick={() => pickFile("back")}
                />
              ) : null}

              {activeKycRules?.selfieRequired ? (
                <UploadTile
                  label="Selfie"
                  url={selfieUrl}
                  uploading={isUploading && uploadTarget === "selfie"}
                  onClick={() => setSelfieCameraOpen(true)}
                  selfie
                />
              ) : null}

              <KycSelfieCamera
                open={selfieCameraOpen}
                onOpenChange={setSelfieCameraOpen}
                onCapture={(file) => uploadFile("selfie", file)}
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
                  disabled={saving || !canSubmit}
                  onClick={() => void saveProgress(true)}
                  className="btn-primary inline-flex h-11 items-center justify-center gap-2 text-sm disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  Submit Level {targetLevel}
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
  targetLevel,
}: {
  submission: Submission | null;
  submittedLabel: string | null;
  targetLevel: number;
}) {
  const docs = [
    { label: "Document", url: submission?.idFrontUrl },
    { label: "ID back", url: submission?.idBackUrl },
    { label: "Selfie", url: submission?.selfieUrl },
  ].filter((d) => d.url);

  return (
    <div className="space-y-4">
      <MotionSection className="overflow-hidden rounded-[28px] border border-border bg-background shadow-[var(--shadow-soft)]">
        <div className="relative overflow-hidden bg-gradient-to-br from-[#ff8124] via-oryno-orange to-[#c94a00] px-5 pb-8 pt-7 text-white">
          <div className="relative flex flex-col items-center text-center">
            <span className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/35">
              <ShieldCheck className="h-8 w-8" strokeWidth={1.75} />
            </span>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/80">
              Level {targetLevel} pending
            </p>
            <h2 className="mt-2 text-2xl font-bold tracking-tight">
              We’re reviewing your KYC
            </h2>
            <p className="mt-2 max-w-sm text-sm text-white/85">
              Your documents are in the review queue. You’ll get a notification
              as soon as a decision is made.
            </p>
            <div className="mt-5 inline-flex items-center gap-2 rounded-full bg-black/15 px-3.5 py-2 text-xs font-semibold ring-1 ring-white/20">
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
                Document
              </p>
              <p className="mt-1 truncate text-sm font-semibold text-foreground">
                {submission?.idType || "—"}
              </p>
            </div>
          </div>

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
                      {done ? <CheckCircle2 className="h-4 w-4" /> : index + 1}
                    </span>
                    {index < REVIEW_STEPS.length - 1 ? (
                      <span className="my-1 min-h-6 w-0.5 flex-1 rounded-full bg-border" />
                    ) : null}
                  </div>
                  <div
                    className={cn(
                      "pb-5",
                      index === REVIEW_STEPS.length - 1 && "pb-0",
                    )}
                  >
                    <p className="text-sm font-semibold text-foreground">
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

          {docs.length ? (
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
          ) : null}
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
          {url
            ? "Tap to replace"
            : selfie
              ? "Tap to take a selfie"
              : "Tap to upload"}
        </p>
      </div>
    </button>
  );
}
