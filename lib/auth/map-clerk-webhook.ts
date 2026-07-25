import type { UserJSON } from "@clerk/nextjs/server";
import type { ClerkUserLike } from "@/lib/auth/sync-user";

export function mapClerkWebhookUser(data: UserJSON): ClerkUserLike {
  const primaryEmail =
    data.email_addresses.find((e) => e.id === data.primary_email_address_id) ??
    data.email_addresses[0];
  const primaryPhone =
    data.phone_numbers.find((p) => p.id === data.primary_phone_number_id) ??
    data.phone_numbers[0];

  return {
    id: data.id,
    username: data.username,
    imageUrl: data.image_url,
    firstName: data.first_name,
    lastName: data.last_name,
    fullName: [data.first_name, data.last_name].filter(Boolean).join(" ") || null,
    primaryEmailAddress: primaryEmail
      ? { emailAddress: primaryEmail.email_address }
      : null,
    emailAddresses: data.email_addresses.map((e) => ({
      emailAddress: e.email_address,
      verification: { status: e.verification?.status ?? null },
    })),
    primaryPhoneNumber: primaryPhone
      ? { phoneNumber: primaryPhone.phone_number }
      : null,
    phoneNumbers: data.phone_numbers.map((p) => ({
      phoneNumber: p.phone_number,
      verification: { status: p.verification?.status ?? null },
    })),
    unsafeMetadata: (data.unsafe_metadata ?? {}) as Record<string, unknown>,
    publicMetadata: (data.public_metadata ?? {}) as Record<string, unknown>,
  };
}
