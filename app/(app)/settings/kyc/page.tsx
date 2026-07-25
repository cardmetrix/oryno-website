"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Camera,
  CheckCircle2,
  FileImage,
  Loader2,
  ShieldAlert,
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
};

const ID_TYPES = ["NIN Slip", "National ID", "Passport", "Driver License"];

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
    if (kycStatus === "verified") return 4;
    if (kycStatus === "pending") return 4;
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

  return (
    <AppShell>
      <PageHeader
        title="KYC Verification"
        subtitle={
          kycStatus === "verified"
            ? "Your identity is verified"
            : kycStatus === "pending"
              ? "Under review"
              : `Step ${Math.min(step, 3)} of 3`
        }
        backHref="/settings"
      />

      {loading ? (
        <MotionSection className="space-y-4 rounded-[28px] border border-border bg-background p-5 shadow-[var(--shadow-soft)]">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-20 w-full rounded-[18px]" />
          <Skeleton className="h-11 w-full rounded-[14px]" />
        </MotionSection>
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
                      : kycStatus === "pending"
                        ? "90%"
                        : `${(step / 3) * 100}%`,
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
            ) : kycStatus === "pending" ? (
              <StatusCard
                icon={CheckCircle2}
                title="Pending review"
                body="We’re reviewing your documents. This usually takes a few hours."
                tone="pending"
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

          {!locked || kycStatus === "rejected" ? (
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
