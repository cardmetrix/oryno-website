import { auth } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { createUploadthing, type FileRouter } from "uploadthing/next";
import { UploadThingError } from "uploadthing/server";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";

const f = createUploadthing();

export const ourFileRouter = {
  profileImage: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) throw new UploadThingError("Unauthorized");
      return { clerkId: userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const url = file.ufsUrl || file.url;

      await db
        .update(users)
        .set({
          avatarUrl: url,
          updatedAt: new Date(),
        })
        .where(eq(users.clerkId, metadata.clerkId));

      return { url, clerkId: metadata.clerkId };
    }),

  kycDocument: f({
    image: {
      maxFileSize: "8MB",
      maxFileCount: 1,
    },
  })
    .middleware(async () => {
      const { userId } = await auth();
      if (!userId) throw new UploadThingError("Unauthorized");
      return { clerkId: userId };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const url = file.ufsUrl || file.url;
      return { url, clerkId: metadata.clerkId };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
