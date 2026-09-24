import { and, desc, eq } from "drizzle-orm";
import { currencyForCountry } from "@/lib/country";
import { db } from "@/lib/db";
import { ensureInvoiceSchema } from "@/lib/db/ensure-schema";
import { invoiceItems, invoices, paymentLinks } from "@/lib/db/schema";
import { formatMoney } from "@/lib/transactions";
import {
  flutterwaveFetch,
  hasFlutterwaveKeys,
  isFlutterwaveDemoMode,
} from "@/lib/flutterwave/client";
import { flutterwavePaymentOptions } from "@/lib/payments/country";
import { resolveCountryCode } from "@/lib/country";

export const INVOICE_FOOTER =
  "Powered by ORYNO — Your Digital World, Simplified.";

export type InvoiceItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function nextNumber() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `INV-${stamp}-${rand}`.slice(0, 40);
}

function paymentSlug() {
  return `pay_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function listUserInvoices(userId: string) {
  await ensureInvoiceSchema();
  return db.query.invoices.findMany({
    where: eq(invoices.userId, userId),
    orderBy: [desc(invoices.createdAt)],
    limit: 100,
  });
}

export async function getUserInvoice(userId: string, invoiceId: string) {
  await ensureInvoiceSchema();
  const invoice = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, invoiceId), eq(invoices.userId, userId)),
  });
  if (!invoice) return null;
  const items = await db.query.invoiceItems.findMany({
    where: eq(invoiceItems.invoiceId, invoice.id),
  });
  const link = await db.query.paymentLinks.findFirst({
    where: and(
      eq(paymentLinks.invoiceId, invoice.id),
      eq(paymentLinks.userId, userId),
    ),
    orderBy: [desc(paymentLinks.createdAt)],
  });
  return { invoice, items, paymentLink: link ?? null };
}

export async function createInvoice(input: {
  userId: string;
  countryCode?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  currency?: string | null;
  notes?: string | null;
  items: InvoiceItemInput[];
}) {
  await ensureInvoiceSchema();
  const name = input.customerName.trim();
  if (!name) throw new Error("Customer name is required");
  if (!input.items?.length) throw new Error("Add at least one line item");

  const currency = (
    input.currency || currencyForCountry(input.countryCode)
  ).toUpperCase();

  const normalized = input.items.map((item) => {
    const quantity = Math.max(0.01, Number(item.quantity) || 1);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const amount = round2(quantity * unitPrice);
    const description = item.description.trim().slice(0, 255);
    if (!description) throw new Error("Each item needs a description");
    return { description, quantity, unitPrice, amount };
  });

  const subtotal = round2(normalized.reduce((s, i) => s + i.amount, 0));
  if (subtotal <= 0) throw new Error("Invoice total must be greater than zero");

  const number = nextNumber();
  const [invoice] = await db
    .insert(invoices)
    .values({
      userId: input.userId,
      number,
      customerName: name.slice(0, 160),
      customerEmail: input.customerEmail?.trim().slice(0, 255) || null,
      customerPhone: input.customerPhone?.trim().slice(0, 40) || null,
      currency,
      subtotal: subtotal.toFixed(2),
      tax: "0.00",
      total: subtotal.toFixed(2),
      notes: input.notes?.trim() || null,
      status: "sent",
      metadata: { footer: INVOICE_FOOTER },
    })
    .returning();

  await db.insert(invoiceItems).values(
    normalized.map((item) => ({
      invoiceId: invoice.id,
      description: item.description,
      quantity: item.quantity.toFixed(2),
      unitPrice: item.unitPrice.toFixed(2),
      amount: item.amount.toFixed(2),
    })),
  );

  return getUserInvoice(input.userId, invoice.id);
}

export async function createPaymentLinkForInvoice(input: {
  userId: string;
  invoiceId: string;
  origin: string;
}) {
  await ensureInvoiceSchema();
  const packed = await getUserInvoice(input.userId, input.invoiceId);
  if (!packed) throw new Error("Invoice not found");
  if (packed.invoice.status === "paid") {
    throw new Error("Invoice is already paid");
  }
  if (packed.paymentLink?.status === "active") {
    return {
      ...packed,
      url: `${input.origin}/pay/${packed.paymentLink.slug}`,
    };
  }

  const slug = paymentSlug();
  const [link] = await db
    .insert(paymentLinks)
    .values({
      userId: input.userId,
      invoiceId: packed.invoice.id,
      slug,
      title: `Invoice ${packed.invoice.number}`,
      amount: packed.invoice.total,
      currency: packed.invoice.currency,
      status: "active",
      metadata: {
        invoiceNumber: packed.invoice.number,
        customerName: packed.invoice.customerName,
      },
    })
    .returning();

  await db
    .update(invoices)
    .set({ status: "sent", updatedAt: new Date() })
    .where(eq(invoices.id, packed.invoice.id));

  return {
    invoice: packed.invoice,
    items: packed.items,
    paymentLink: link,
    url: `${input.origin}/pay/${slug}`,
  };
}

export async function getPaymentLinkBySlug(slug: string) {
  await ensureInvoiceSchema();
  const link = await db.query.paymentLinks.findFirst({
    where: eq(paymentLinks.slug, slug),
  });
  if (!link) return null;
  const invoice = link.invoiceId
    ? await db.query.invoices.findFirst({
        where: eq(invoices.id, link.invoiceId),
      })
    : null;
  return { link, invoice };
}

export async function initiatePaymentLinkCheckout(input: {
  slug: string;
  customerEmail?: string | null;
  customerName?: string | null;
  origin: string;
  countryCode?: string | null;
}) {
  await ensureInvoiceSchema();
  const packed = await getPaymentLinkBySlug(input.slug);
  if (!packed) throw new Error("Payment link not found");
  if (packed.link.status === "paid") throw new Error("Already paid");
  if (packed.link.status !== "active") throw new Error("Link is not active");

  const amount = Number(packed.link.amount);
  const currency = packed.link.currency.toUpperCase();
  const email =
    input.customerEmail?.trim() ||
    packed.invoice?.customerEmail ||
    "customer@orynoafrica.com";
  const name =
    input.customerName?.trim() ||
    packed.invoice?.customerName ||
    "ORYNO Customer";
  const reference = `INVPAY_${Date.now().toString(36).toUpperCase()}`;
  const countryCode = resolveCountryCode(input.countryCode);

  if (isFlutterwaveDemoMode() || !hasFlutterwaveKeys()) {
    await markPaymentLinkPaid({
      slug: input.slug,
      reference: `${reference}_DEMO`,
      raw: { demo: true },
    });
    return {
      demo: true as const,
      reference: `${reference}_DEMO`,
      amountFormatted: formatMoney(amount, currency),
      redirectUrl: `${input.origin}/pay/${input.slug}?paid=1`,
    };
  }

  const res = await flutterwaveFetch<{ link?: string; authorization_url?: string }>(
    "/payments",
    {
      method: "POST",
      body: JSON.stringify({
        tx_ref: reference,
        amount,
        currency,
        redirect_url: `${input.origin}/pay/${input.slug}?paid=1`,
        payment_options: flutterwavePaymentOptions(countryCode),
        customer: { email, name },
        customizations: {
          title: packed.link.title,
          description: INVOICE_FOOTER,
        },
        meta: {
          purpose: "invoice_payment",
          paymentLinkSlug: input.slug,
          invoiceId: packed.invoice?.id ?? null,
        },
      }),
    },
  );

  const checkoutUrl = res.data?.link || res.data?.authorization_url;
  if (!checkoutUrl) throw new Error("Could not start payment");

  await db
    .update(paymentLinks)
    .set({
      flutterwaveRef: reference,
      metadata: {
        ...((packed.link.metadata as Record<string, unknown>) || {}),
        lastCheckoutRef: reference,
      },
      updatedAt: new Date(),
    })
    .where(eq(paymentLinks.id, packed.link.id));

  return {
    demo: false as const,
    reference,
    checkoutUrl,
    amountFormatted: formatMoney(amount, currency),
  };
}

export async function markPaymentLinkPaid(input: {
  slug: string;
  reference: string;
  raw?: Record<string, unknown>;
}) {
  await ensureInvoiceSchema();
  const packed = await getPaymentLinkBySlug(input.slug);
  if (!packed) return { ok: false as const };
  if (packed.link.status === "paid") return { ok: true as const, duplicated: true };

  await db
    .update(paymentLinks)
    .set({
      status: "paid",
      paidAt: new Date(),
      flutterwaveRef: input.reference,
      metadata: {
        ...((packed.link.metadata as Record<string, unknown>) || {}),
        paidRaw: input.raw ?? null,
      },
      updatedAt: new Date(),
    })
    .where(eq(paymentLinks.id, packed.link.id));

  if (packed.invoice) {
    await db
      .update(invoices)
      .set({
        status: "paid",
        paidAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, packed.invoice.id));
  }

  return { ok: true as const, duplicated: false };
}

export async function listAdminInvoices(limit = 50) {
  await ensureInvoiceSchema();
  return db.query.invoices.findMany({
    orderBy: [desc(invoices.createdAt)],
    limit,
  });
}
