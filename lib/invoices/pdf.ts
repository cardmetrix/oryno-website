import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import {
  INVOICE_FOOTER,
  ORYNO_INVOICE_COMPANY,
} from "@/lib/invoices/constants";
import { summarizeInvoice } from "@/lib/invoices";
import type {
  invoiceItems as invoiceItemsTable,
  invoices as invoicesTable,
} from "@/lib/db/schema";

function invoiceFontPath() {
  const candidates = [
    path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"),
    path.join(process.cwd(), "vendor/fonts/NotoSans-Regular.ttf"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

function money(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function fmtDate(iso: string | null | undefined) {
  if (!iso) return "-";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function clip(text: string, max: number) {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1)).trimEnd()}…`;
}

/** Absolute text that does not advance PDFKit's flow cursor / create pages. */
function at(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  opts: {
    size?: number;
    color?: string;
    width?: number;
    align?: "left" | "center" | "right";
  } = {},
) {
  const { size = 9, color = "#111827", width, align } = opts;
  doc.save();
  doc.fillColor(color).fontSize(size);
  doc.text(text, x, y, {
    width,
    align,
    lineBreak: false,
    continued: false,
  });
  doc.restore();
}

export async function buildInvoicePdf(input: {
  invoice: typeof invoicesTable.$inferSelect;
  items: (typeof invoiceItemsTable.$inferSelect)[];
}): Promise<Buffer> {
  const summary = summarizeInvoice(input.invoice, input.items);
  const font = invoiceFontPath();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 0,
      autoFirstPage: true,
      info: {
        Title: `Invoice ${input.invoice.number}`,
        Author: ORYNO_INVOICE_COMPANY.name,
      },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c as Buffer));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      if (fs.existsSync(font)) doc.font(font);
    } catch {
      // default font
    }

    // Force a single sheet — never let PDFKit paginate this layout.
    doc.addPage = (() => doc) as typeof doc.addPage;

    const orange = "#FF6A00";
    const muted = "#6B7280";
    const ink = "#111827";
    const left = 40;
    const right = doc.page.width - 40;
    const pageWidth = right - left;
    let y = 40;

    // Header
    at(doc, "INVOICE", left, y, { size: 20, color: orange });
    at(doc, `# ${input.invoice.number}`, left + 118, y + 6, {
      size: 11,
      color: ink,
    });
    at(doc, input.invoice.status.toUpperCase(), right - 90, y + 6, {
      size: 9,
      color: muted,
      width: 90,
      align: "right",
    });
    y += 30;

    // Meta
    const metas = [
      { label: "Date", value: fmtDate(summary.issuedAt), x: left },
      {
        label: "Payment Terms",
        value: clip(input.invoice.paymentTerms || "-", 22),
        x: left + 130,
      },
      { label: "Due Date", value: fmtDate(summary.dueAt), x: left + 280 },
      {
        label: "PO Number",
        value: clip(input.invoice.poNumber || "-", 18),
        x: left + 400,
      },
    ];
    for (const m of metas) {
      at(doc, m.label, m.x, y, { size: 7, color: muted });
      at(doc, m.value, m.x, y + 11, { size: 9, color: ink, width: 120 });
    }
    y += 34;

    // Parties
    const colW = (pageWidth - 16) / 3;
    const parties = [
      {
        label: "From",
        name: input.invoice.fromName || "-",
        lines: [
          input.invoice.fromEmail,
          input.invoice.fromPhone,
          input.invoice.fromAddress,
        ],
        x: left,
      },
      {
        label: "Bill To",
        name: input.invoice.customerName || "-",
        lines: [
          input.invoice.customerEmail,
          input.invoice.customerPhone,
          input.invoice.customerAddress,
        ],
        x: left + colW + 8,
      },
      {
        label: "Ship To",
        name: input.invoice.shipToName || "-",
        lines: [input.invoice.shipToAddress],
        x: left + (colW + 8) * 2,
      },
    ];

    for (const party of parties) {
      let py = y;
      at(doc, party.label, party.x, py, { size: 7, color: muted });
      py += 11;
      at(doc, clip(party.name, 42), party.x, py, {
        size: 9,
        color: ink,
        width: colW,
      });
      py += 13;
      for (const line of party.lines.filter(Boolean).slice(0, 3)) {
        at(doc, clip(String(line), 48), party.x, py, {
          size: 8,
          color: muted,
          width: colW,
        });
        py += 11;
      }
    }
    y += 58;

    doc
      .moveTo(left, y)
      .lineTo(right, y)
      .strokeColor("#E5E7EB")
      .lineWidth(1)
      .stroke();
    y += 10;

    // Table header
    at(doc, "Item", left, y, { size: 7, color: muted });
    at(doc, "Qty", left + 260, y, {
      size: 7,
      color: muted,
      width: 36,
      align: "right",
    });
    at(doc, "Rate", left + 310, y, {
      size: 7,
      color: muted,
      width: 90,
      align: "right",
    });
    at(doc, "Amount", left + 410, y, {
      size: 7,
      color: muted,
      width: pageWidth - 410,
      align: "right",
    });
    y += 12;
    doc.moveTo(left, y).lineTo(right, y).strokeColor("#E5E7EB").stroke();
    y += 8;

    const maxItemRows = 12;
    const rows = input.items.slice(0, maxItemRows);
    for (const item of rows) {
      at(doc, clip(item.description, 55), left, y, {
        size: 9,
        color: ink,
        width: 250,
      });
      at(doc, String(Number(item.quantity)), left + 260, y, {
        size: 9,
        color: ink,
        width: 36,
        align: "right",
      });
      at(
        doc,
        money(Number(item.unitPrice), summary.currency),
        left + 310,
        y,
        { size: 9, color: ink, width: 90, align: "right" },
      );
      at(doc, money(Number(item.amount), summary.currency), left + 410, y, {
        size: 9,
        color: ink,
        width: pageWidth - 410,
        align: "right",
      });
      y += 16;
    }
    if (input.items.length > maxItemRows) {
      at(
        doc,
        `+ ${input.items.length - maxItemRows} more item(s)`,
        left,
        y,
        { size: 8, color: muted },
      );
      y += 14;
    }

    doc.moveTo(left, y).lineTo(right, y).strokeColor("#E5E7EB").stroke();
    y += 12;

    const totals: Array<{ label: string; value: string; bold?: boolean }> = [
      { label: "Subtotal", value: summary.subtotalFormatted },
    ];
    if (summary.discount > 0) {
      totals.push({
        label: "Discount",
        value: `-${summary.discountFormatted}`,
      });
    }
    if (summary.taxRate > 0 || summary.tax > 0) {
      totals.push({
        label: `Tax (${summary.taxRate}%)`,
        value: summary.taxFormatted,
      });
    }
    if (summary.shipping > 0) {
      totals.push({ label: "Shipping", value: summary.shippingFormatted });
    }
    totals.push({
      label: "Total",
      value: summary.totalFormatted,
      bold: true,
    });
    if (summary.amountPaid > 0) {
      totals.push({
        label: "Amount Paid",
        value: summary.amountPaidFormatted,
      });
    }
    totals.push({
      label: "Balance Due",
      value: summary.balanceDueFormatted,
      bold: true,
    });

    for (const row of totals) {
      at(doc, row.label, left + 310, y, {
        size: row.bold ? 10 : 9,
        color: row.bold ? ink : muted,
        width: 90,
      });
      at(doc, row.value, left + 410, y, {
        size: row.bold ? 10 : 9,
        color: ink,
        width: pageWidth - 410,
        align: "right",
      });
      y += row.bold ? 15 : 13;
    }

    if (input.invoice.notes) {
      y += 8;
      at(doc, "Notes", left, y, { size: 7, color: muted });
      y += 11;
      at(doc, clip(input.invoice.notes, 180), left, y, {
        size: 8,
        color: ink,
        width: pageWidth,
      });
      y += 14;
    }
    if (input.invoice.terms) {
      y += 4;
      at(doc, "Terms", left, y, { size: 7, color: muted });
      y += 11;
      at(doc, clip(input.invoice.terms, 180), left, y, {
        size: 8,
        color: ink,
        width: pageWidth,
      });
    }

    // Footer on the same single page
    const footerTop = doc.page.height - 50;
    doc
      .moveTo(left, footerTop)
      .lineTo(right, footerTop)
      .strokeColor("#E5E7EB")
      .stroke();
    at(doc, ORYNO_INVOICE_COMPANY.name, left, footerTop + 8, {
      size: 9,
      color: orange,
    });
    at(
      doc,
      `${ORYNO_INVOICE_COMPANY.tagline}  ·  ${ORYNO_INVOICE_COMPANY.website}  ·  ${ORYNO_INVOICE_COMPANY.email}`,
      left,
      footerTop + 22,
      { size: 7, color: muted, width: pageWidth },
    );
    at(doc, INVOICE_FOOTER, left, footerTop + 34, {
      size: 7,
      color: muted,
      width: pageWidth,
    });

    doc.end();
  });
}
