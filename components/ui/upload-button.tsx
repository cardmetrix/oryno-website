import React, { useRef } from "react";
import { Button } from "@/components/ui/button";
import { useUploadThing } from "@/lib/uploadthing";
import type { OurFileRouter } from "@/app/api/uploadthing/core";

type UploadedFile = {
  name: string;
  size: number;
  url: string;
  key: string;
};

interface UploadButtonProps {
  endpoint: keyof OurFileRouter;
  onClientUploadComplete?: (res: UploadedFile[]) => void;
  onUploadError?: (error: Error) => void;
  onUploadStart?: () => void;
  children: React.ReactNode;
  className?: string;
}

export const UploadButton: React.FC<UploadButtonProps> = ({
  endpoint,
  onClientUploadComplete,
  onUploadError,
  onUploadStart,
  children,
  className
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { startUpload, isUploading } = useUploadThing(endpoint, {
    onClientUploadComplete,
    onUploadError,
  });

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    fileInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const fileArray = Array.from(files);
      console.log(`📁 Files selected for ${endpoint}:`, fileArray.map(f => ({ name: f.name, size: f.size, type: f.type })));
      if (onUploadStart) {
        onUploadStart();
      }
      void startUpload(fileArray).catch((err) => {
        console.error(`❌ UploadThing startUpload failed for ${endpoint}:`, err);
        const error = err instanceof Error ? err : new Error(String(err));
        onUploadError?.(error);
      });
    }
    // Reset input to allow selecting the same file again
    event.target.value = '';
  };

  const getAcceptTypes = () => {
    const acceptTypesMap: Record<string, string> = {
      imageUploader: "image/*",
      profileImage: "image/*",
      subAgentProfile: "image/*",
      subAgentDocuments: "image/*,.pdf",
      documentUploader: ".pdf,.doc,.docx,.xls,.xlsx,.txt",
      providerDocuments: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt",
      shopDocuments: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt",
      pharmacyDocuments: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt",
      pharmacyLogo: "image/*",
      beautyDocuments: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt",
      beautyLogo: "image/*",
      supermarketDocuments: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt",
      supermarketLogo: "image/*",
      laundryDocuments: "image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt",
      laundryLogo: "image/*",
      fleetImages: "image/*",
      receiptUploader: "image/*,.pdf",
      cryptocurrencyLogo: "image/*",
      transactionImage: "image/*",
      kycDocument: "image/*",
      copyTraderProfile: "image/*",
    };
    return acceptTypesMap[endpoint] || "image/*";
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept={getAcceptTypes()}
        onChange={handleFileChange}
        multiple={endpoint === 'pharmacyLogo' || endpoint === 'fleetImages'}
        // Avoid `display:none` because some browsers can be flaky with programmatic clicks on hidden inputs.
        className="sr-only"
      />
      <Button
        type="button"
        onClick={handleClick}
        disabled={isUploading}
        className={className}
      >
        {isUploading ? "Uploading..." : children}
      </Button>
    </>
  );
};