import { and, desc, eq } from "drizzle-orm";
import { currencyForCountry } from "@/lib/country";
import { db } from "@/lib/db";
import { ensureInvoiceSchema } from "@/lib/db/ensure-schema";
import { invoiceItems, invoices, paymentLinks, platformSettings, users } from "@/lib/db/schema";
import { formatMoney } from "@/lib/transactions";
import {
  flutterwaveFetch,
  hasFlutterwaveKeys,
  isFlutterwaveDemoMode,
} from "@/lib/flutterwave/client";
import { flutterwavePaymentOptions } from "@/lib/payments/country";
import { resolveCountryCode } from "@/lib/country";
import {
  LEGAL_COMPANY,
  LEGAL_SUPPORT_EMAIL,
  LEGAL_WEBSITE,
} from "@/lib/legal/content";

export const INVOICE_FOOTER =
  "Powered by ORYNO - Your Digital World, Simplified.";

export const ORYNO_INVOICE_COMPANY = {
  name: LEGAL_COMPANY,
  website: LEGAL_WEBSITE,
  email: LEGAL_SUPPORT_EMAIL,
  tagline: "Your Digital World, Simplified.",
};

export type InvoiceItemInput = {
  description: string;
  quantity: number;
  unitPrice: number;
};

export type InvoiceTotalsInput = {
  items: InvoiceItemInput[];
  taxRate?: number;
  discount?: number;
  shipping?: number;
  amountPaid?: number;
};

export type CreateInvoiceInput = {
  userId: string;
  countryCode?: string | null;
  currency?: string | null;
  status?: "draft" | "sent";
  fromName?: string | null;
  fromEmail?: string | null;
  fromPhone?: string | null;
  fromAddress?: string | null;
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  customerAddress?: string | null;
  shipToName?: string | null;
  shipToAddress?: string | null;
  notes?: string | null;
  terms?: string | null;
  paymentTerms?: string | null;
  poNumber?: string | null;
  issuedAt?: string | null;
  dueAt?: string | null;
  taxRate?: number;
  discount?: number;
  shipping?: number;
  amountPaid?: number;
  items: InvoiceItemInput[];
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

function parseDate(value?: string | null) {
  if (!value?.trim()) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function computeInvoiceTotals(input: InvoiceTotalsInput) {
  const normalized = input.items.map((item) => {
    const quantity = Math.max(0.01, Number(item.quantity) || 1);
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const amount = round2(quantity * unitPrice);
    const description = (item.description || "").trim().slice(0, 255);
    if (!description) throw new Error("Each item needs a description");
    return { description, quantity, unitPrice, amount };
  });

  const subtotal = round2(normalized.reduce((s, i) => s + i.amount, 0));
  const discount = Math.max(0, round2(Number(input.discount) || 0));
  const shipping = Math.max(0, round2(Number(input.shipping) || 0));
  const taxRate = Math.max(0, Number(input.taxRate) || 0);
  const taxable = Math.max(0, subtotal - discount);
  const tax = round2((taxable * taxRate) / 100);
  const total = round2(taxable + tax + shipping);
  const amountPaid = Math.max(0, round2(Number(input.amountPaid) || 0));
  const balanceDue = round2(Math.max(0, total - amountPaid));

  return {
    normalized,
    subtotal,
    discount,
    shipping,
    taxRate,
    tax,
    total,
    amountPaid,
    balanceDue,
  };
}

export function summarizeInvoice(
  invoice: typeof invoices.$inferSelect,
  items: (typeof invoiceItems.$inferSelect)[] = [],
) {
  const subtotal = Number(invoice.subtotal);
  const tax = Number(invoice.tax);
  const discount = Number(invoice.discount ?? 0);
  const shipping = Number(invoice.shipping ?? 0);
  const total = Number(invoice.total);
  const amountPaid = Number(invoice.amountPaid ?? 0);
  const balanceDue = round2(Math.max(0, total - amountPaid));
  return {
    id: invoice.id,
    number: invoice.number,
    status: invoice.status,
    currency: invoice.currency,
    customerName: invoice.customerName,
    customerEmail: invoice.customerEmail,
    fromName: invoice.fromName,
    subtotal,
    tax,
    taxRate: Number(invoice.taxRate ?? 0),
    discount,
    shipping,
    total,
    amountPaid,
    balanceDue,
    itemCount: items.length,
    issuedAt: invoice.issuedAt?.toISOString() ?? invoice.createdAt.toISOString(),
    dueAt: invoice.dueAt?.toISOString() ?? null,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    createdAt: invoice.createdAt.toISOString(),
    subtotalFormatted: formatMoney(subtotal, invoice.currency),
    taxFormatted: formatMoney(tax, invoice.currency),
    discountFormatted: formatMoney(discount, invoice.currency),
    shippingFormatted: formatMoney(shipping, invoice.currency),
    totalFormatted: formatMoney(total, invoice.currency),
    amountPaidFormatted: formatMoney(amountPaid, invoice.currency),
    balanceDueFormatted: formatMoney(balanceDue, invoice.currency),
  };
}

export async function listUserInvoices(userId: string) {
  await ensureInvoiceSchema();
  const rows = await db.query.invoices.findMany({
    where: eq(invoices.userId, userId),
    orderBy: [desc(invoices.createdAt)],
    limit: 100,
  });
  return rows.map((row) => summarizeInvoice(row));
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
  return {
    invoice,
    items,
    paymentLink: link ?? null,
    summary: summarizeInvoice(invoice, items),
  };
}

export async function createInvoice(input: CreateInvoiceInput) {
  await ensureInvoiceSchema();
  const name = input.customerName.trim();
  if (!name) throw new Error("Customer name (Bill To) is required");
  if (!input.items?.length) throw new Error("Add at least one line item");

  const currency = (
    input.currency || currencyForCountry(input.countryCode)
  ).toUpperCase();

  const totals = computeInvoiceTotals({
    items: input.items,
    taxRate: input.taxRate,
    discount: input.discount,
    shipping: input.shipping,
    amountPaid: input.amountPaid,
  });
  if (totals.total < 0) throw new Error("Invoice total is invalid");

  const status = input.status === "draft" ? "draft" : "sent";
  const issuedAt = parseDate(input.issuedAt) || new Date();
  const dueAt = parseDate(input.dueAt);

  const [invoice] = await db
    .insert(invoices)
    .values({
      userId: input.userId,
      number: nextNumber(),
      fromName: input.fromName?.trim().slice(0, 160) || null,
      fromEmail: input.fromEmail?.trim().slice(0, 255) || null,
      fromPhone: input.fromPhone?.trim().slice(0, 40) || null,
      fromAddress: input.fromAddress?.trim() || null,
      customerName: name.slice(0, 160),
      customerEmail: input.customerEmail?.trim().slice(0, 255) || null,
      customerPhone: input.customerPhone?.trim().slice(0, 40) || null,
      customerAddress: input.customerAddress?.trim() || null,
      shipToName: input.shipToName?.trim().slice(0, 160) || null,
      shipToAddress: input.shipToAddress?.trim() || null,
      currency,
      subtotal: totals.subtotal.toFixed(2),
      taxRate: totals.taxRate.toFixed(4),
      tax: totals.tax.toFixed(2),
      discount: totals.discount.toFixed(2),
      shipping: totals.shipping.toFixed(2),
      total: totals.total.toFixed(2),
      amountPaid: totals.amountPaid.toFixed(2),
      notes: input.notes?.trim() || null,
      terms: input.terms?.trim() || null,
      paymentTerms: input.paymentTerms?.trim().slice(0, 80) || null,
      poNumber: input.poNumber?.trim().slice(0, 80) || null,
      status,
      issuedAt,
      dueAt,
      paidAt: totals.balanceDue <= 0 && totals.total > 0 ? new Date() : null,
      metadata: {
        footer: INVOICE_FOOTER,
        company: ORYNO_INVOICE_COMPANY,
      },
    })
    .returning();

  if (totals.balanceDue <= 0 && totals.total > 0) {
    await db
      .update(invoices)
      .set({ status: "paid", updatedAt: new Date() })
      .where(eq(invoices.id, invoice.id));
  }

  await db.insert(invoiceItems).values(
    totals.normalized.map((item) => ({
      invoiceId: invoice.id,
      description: item.description,
      quantity: item.quantity.toFixed(2),
      unitPrice: item.unitPrice.toFixed(2),
      amount: item.amount.toFixed(2),
    })),
  );

  return getUserInvoice(input.userId, invoice.id);
}

export async function updateInvoiceStatus(input: {
  userId: string;
  invoiceId: string;
  status: "draft" | "sent" | "cancelled" | "paid";
}) {
  await ensureInvoiceSchema();
  const packed = await getUserInvoice(input.userId, input.invoiceId);
  if (!packed) throw new Error("Invoice not found");

  const [updated] = await db
    .update(invoices)
    .set({
      status: input.status,
      paidAt: input.status === "paid" ? new Date() : packed.invoice.paidAt,
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, packed.invoice.id))
    .returning();

  return updated;
}

export async function createPaymentLinkForInvoice(input: {
  userId: string;
  invoiceId: string;
  origin: string;
}) {
  await ensureInvoiceSchema();
  const packed = await getUserInvoice(input.userId, input.invoiceId);
  if (!packed) throw new Error("Invoice not found");
  if (packed.summary.balanceDue <= 0) {
    throw new Error("Nothing left to collect on this invoice");
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
      amount: packed.summary.balanceDue.toFixed(2),
      currency: packed.invoice.currency,
      status: "active",
      metadata: {
        invoiceNumber: packed.invoice.number,
        customerName: packed.invoice.customerName,
        kind: "invoice",
      },
    })
    .returning();

  if (packed.invoice.status === "draft") {
    await db
      .update(invoices)
      .set({ status: "sent", updatedAt: new Date() })
      .where(eq(invoices.id, packed.invoice.id));
  }

  return {
    ...(await getUserInvoice(input.userId, packed.invoice.id))!,
    paymentLink: link,
    url: `${input.origin}/pay/${slug}`,
  };
}

/** Standalone payment link (not tied to an invoice). */
export async function createStandalonePaymentLink(input: {
  userId: string;
  title: string;
  amount: number;
  currency?: string | null;
  countryCode?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  note?: string | null;
  origin: string;
}) {
  await ensureInvoiceSchema();
  const title = input.title.trim().slice(0, 160);
  if (!title) throw new Error("Title is required");
  const amount = round2(Number(input.amount) || 0);
  if (amount <= 0) throw new Error("Amount must be greater than zero");
  const currency = (
    input.currency || currencyForCountry(input.countryCode)
  ).toUpperCase();
  const slug = paymentSlug();

  const [link] = await db
    .insert(paymentLinks)
    .values({
      userId: input.userId,
      invoiceId: null,
      slug,
      title,
      amount: amount.toFixed(2),
      currency,
      status: "active",
      metadata: {
        kind: "standalone",
        customerName: input.customerName?.trim() || null,
        customerEmail: input.customerEmail?.trim() || null,
        note: input.note?.trim() || null,
      },
    })
    .returning();

  return {
    link,
    url: `${input.origin}/pay/${slug}`,
    amountFormatted: formatMoney(amount, currency),
  };
}

export async function listUserPaymentLinks(userId: string) {
  await ensureInvoiceSchema();
  const rows = await db.query.paymentLinks.findMany({
    where: eq(paymentLinks.userId, userId),
    orderBy: [desc(paymentLinks.createdAt)],
    limit: 100,
  });
  return rows.map((link) => ({
    id: link.id,
    slug: link.slug,
    title: link.title,
    amount: Number(link.amount),
    amountFormatted: formatMoney(Number(link.amount), link.currency),
    currency: link.currency,
    status: link.status,
    invoiceId: link.invoiceId,
    kind:
      (link.metadata as { kind?: string } | null)?.kind ||
      (link.invoiceId ? "invoice" : "standalone"),
    createdAt: link.createdAt.toISOString(),
    paidAt: link.paidAt?.toISOString() ?? null,
    urlPath: `/pay/${link.slug}`,
  }));
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
  const meta = (packed.link.metadata || {}) as Record<string, unknown>;
  const email =
    input.customerEmail?.trim() ||
    packed.invoice?.customerEmail ||
    (typeof meta.customerEmail === "string" ? meta.customerEmail : null) ||
    "customer@orynoafrica.com";
  const name =
    input.customerName?.trim() ||
    packed.invoice?.customerName ||
    (typeof meta.customerName === "string" ? meta.customerName : null) ||
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
        ...meta,
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
    const paidAmount = Number(packed.link.amount);
    const nextPaid = round2(Number(packed.invoice.amountPaid ?? 0) + paidAmount);
    const total = Number(packed.invoice.total);
    const fullyPaid = nextPaid >= total - 0.001;
    await db
      .update(invoices)
      .set({
        amountPaid: nextPaid.toFixed(2),
        status: fullyPaid ? "paid" : "sent",
        paidAt: fullyPaid ? new Date() : packed.invoice.paidAt,
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, packed.invoice.id));
  }

  return { ok: true as const, duplicated: false };
}

export async function listAdminInvoices(limit = 80) {
  await ensureInvoiceSchema();
  const { inArray } = await import("drizzle-orm");
  const rows = await db.query.invoices.findMany({
    orderBy: [desc(invoices.createdAt)],
    limit,
  });
  const userIds = [...new Set(rows.map((r) => r.userId))];
  const loadedUsers =
    userIds.length > 0
      ? await db.query.users.findMany({
          where: inArray(users.id, userIds),
        })
      : [];
  const byId = new Map(loadedUsers.map((u) => [u.id, u]));

  return rows.map((row) => {
    const summary = summarizeInvoice(row);
    const user = byId.get(row.userId);
    return {
      ...summary,
      user: {
        id: row.userId,
        name: user?.fullName || "User",
        email: user?.email || "",
      },
    };
  });
}

export async function getInvoiceSettings() {
  const row = await db.query.platformSettings.findFirst({
    where: eq(platformSettings.key, "invoices"),
  });
  const raw = (row?.value || {}) as {
    enabled?: boolean;
    paymentLinksEnabled?: boolean;
  };
  return {
    enabled: raw.enabled !== false,
    paymentLinksEnabled: raw.paymentLinksEnabled !== false,
  };
}

export async function setInvoiceSettings(input: {
  enabled?: boolean;
  paymentLinksEnabled?: boolean;
}) {
  const current = await getInvoiceSettings();
  const next = {
    enabled: input.enabled ?? current.enabled,
    paymentLinksEnabled:
      input.paymentLinksEnabled ?? current.paymentLinksEnabled,
  };
  await db
    .insert(platformSettings)
    .values({ key: "invoices", value: next, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: platformSettings.key,
      set: { value: next, updatedAt: new Date() },
    });
  return next;
}
