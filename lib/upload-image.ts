import { UTApi, UTFile } from "uploadthing/server";

export type ImagePayload = {
  filename?: string;
  mime?: string;
  base64: string;
};

const MAX_BASE64_CHARS = 8_000_000; // ~6MB decoded

/** Upload a base64 image via UploadThing (KYC, ads, etc.). */
export async function uploadBase64Image(
  image?: ImagePayload | null,
  fallbackName = "upload.jpg",
): Promise<string | null> {
  if (!image?.base64?.trim()) return null;

  const base64 = image.base64.replace(/^data:[^;]+;base64,/, "");
  if (base64.length > MAX_BASE64_CHARS) {
    throw new Error("Image must be under 6MB");
  }

  const utapi = new UTApi();
  const bytes = Buffer.from(base64, "base64");
  const mime = image.mime || "image/jpeg";
  const filename = image.filename || fallbackName;
  const file = new UTFile([bytes], filename, { type: mime });

  const result = await utapi.uploadFiles(file);
  if (result.error) {
    throw new Error(result.error.message || "Image upload failed");
  }

  return result.data.ufsUrl || result.data.url || null;
}
