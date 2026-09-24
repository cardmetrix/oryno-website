import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import {
  INVOICE_FOOTER,
  ORYNO_INVOICE_COMPANY,
  summarizeInvoice,
} from "@/lib/invoices";
import type { invoiceItems as invoiceItemsTable, invoices as invoicesTable } from "@/lib/db/schema";

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

export async function buildInvoicePdf(input: {
  invoice: typeof invoicesTable.$inferSelect;
  items: (typeof invoiceItemsTable.$inferSelect)[];
}): Promise<Buffer> {
  const summary = summarizeInvoice(input.invoice, input.items);
  const font = invoiceFontPath();

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margin: 48,
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

    const orange = "#FF6A00";
    const muted = "#6B7280";
    const ink = "#111827";
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

    // Header
    doc.fillColor(orange).fontSize(22).text("INVOICE", { continued: false });
    doc
      .fillColor(ink)
      .fontSize(11)
      .text(`# ${input.invoice.number}`, { align: "left" });
    doc.moveDown(0.3);
    doc
      .fillColor(muted)
      .fontSize(9)
      .text(`Status: ${input.invoice.status.toUpperCase()}`);

    doc.moveDown(1);

    // Meta row
    const metaY = doc.y;
    doc.fillColor(muted).fontSize(8).text("Date", 48, metaY);
    doc.fillColor(ink).fontSize(10).text(fmtDate(summary.issuedAt), 48, metaY + 12);
    doc.fillColor(muted).fontSize(8).text("Payment Terms", 180, metaY);
    doc
      .fillColor(ink)
      .fontSize(10)
      .text(input.invoice.paymentTerms || "-", 180, metaY + 12);
    doc.fillColor(muted).fontSize(8).text("Due Date", 320, metaY);
    doc.fillColor(ink).fontSize(10).text(fmtDate(summary.dueAt), 320, metaY + 12);
    if (input.invoice.poNumber) {
      doc.fillColor(muted).fontSize(8).text("PO Number", 440, metaY);
      doc
        .fillColor(ink)
        .fontSize(10)
        .text(input.invoice.poNumber, 440, metaY + 12);
    }
    doc.y = metaY + 40;

    // From / Bill To / Ship To
    const colW = pageWidth / 3 - 8;
    const blockY = doc.y;
    function party(
      x: number,
      label: string,
      name: string | null | undefined,
      lines: (string | null | undefined)[],
    ) {
      doc.fillColor(muted).fontSize(8).text(label, x, blockY);
      doc
        .fillColor(ink)
        .fontSize(10)
        .text(name || "-", x, blockY + 12, { width: colW });
      let y = blockY + 26;
      for (const line of lines.filter(Boolean)) {
        doc
          .fillColor(muted)
          .fontSize(8)
          .text(String(line), x, y, { width: colW });
        y += 11;
      }
    }

    party(48, "Who is this from?", input.invoice.fromName, [
      input.invoice.fromEmail,
      input.invoice.fromPhone,
      input.invoice.fromAddress,
    ]);
    party(48 + colW + 12, "Bill To", input.invoice.customerName, [
      input.invoice.customerEmail,
      input.invoice.customerPhone,
      input.invoice.customerAddress,
    ]);
    party(48 + (colW + 12) * 2, "Ship To", input.invoice.shipToName, [
      input.invoice.shipToAddress,
    ]);

    doc.y = blockY + 78;
    doc
      .moveTo(48, doc.y)
      .lineTo(48 + pageWidth, doc.y)
      .strokeColor("#E5E7EB")
      .stroke();
    doc.moveDown(1);

    // Table header
    const tableTop = doc.y;
    doc.fillColor(muted).fontSize(8);
    doc.text("Item", 48, tableTop, { width: 220 });
    doc.text("Qty", 280, tableTop, { width: 40, align: "right" });
    doc.text("Rate", 330, tableTop, { width: 80, align: "right" });
    doc.text("Amount", 420, tableTop, { width: 100, align: "right" });
    doc.y = tableTop + 14;
    doc
      .moveTo(48, doc.y)
      .lineTo(48 + pageWidth, doc.y)
      .strokeColor("#E5E7EB")
      .stroke();
    doc.moveDown(0.5);

    for (const item of input.items) {
      const y = doc.y;
      doc.fillColor(ink).fontSize(9);
      doc.text(item.description, 48, y, { width: 220 });
      doc.text(String(Number(item.quantity)), 280, y, {
        width: 40,
        align: "right",
      });
      doc.text(money(Number(item.unitPrice), summary.currency), 330, y, {
        width: 80,
        align: "right",
      });
      doc.text(money(Number(item.amount), summary.currency), 420, y, {
        width: 100,
        align: "right",
      });
      doc.moveDown(0.8);
    }

    doc.moveDown(0.5);
    doc
      .moveTo(48, doc.y)
      .lineTo(48 + pageWidth, doc.y)
      .strokeColor("#E5E7EB")
      .stroke();
    doc.moveDown(0.8);

    // Totals
    const totalsX = 340;
    function totalRow(label: string, value: string, bold = false) {
      const y = doc.y;
      doc
        .fillColor(bold ? ink : muted)
        .fontSize(bold ? 11 : 9)
        .text(label, totalsX, y, { width: 80 });
      doc
        .fillColor(ink)
        .fontSize(bold ? 11 : 9)
        .text(value, 420, y, { width: 100, align: "right" });
      doc.moveDown(0.55);
    }

    totalRow("Subtotal", summary.subtotalFormatted);
    if (summary.discount > 0) totalRow("Discount", `-${summary.discountFormatted}`);
    if (summary.taxRate > 0 || summary.tax > 0) {
      totalRow(`Tax (${summary.taxRate}%)`, summary.taxFormatted);
    }
    if (summary.shipping > 0) totalRow("Shipping", summary.shippingFormatted);
    totalRow("Total", summary.totalFormatted, true);
    if (summary.amountPaid > 0) {
      totalRow("Amount Paid", summary.amountPaidFormatted);
    }
    totalRow("Balance Due", summary.balanceDueFormatted, true);

    // Notes / terms
    if (input.invoice.notes) {
      doc.moveDown(1);
      doc.fillColor(muted).fontSize(8).text("Notes");
      doc.fillColor(ink).fontSize(9).text(input.invoice.notes, {
        width: pageWidth,
      });
    }
    if (input.invoice.terms) {
      doc.moveDown(0.8);
      doc.fillColor(muted).fontSize(8).text("Terms");
      doc.fillColor(ink).fontSize(9).text(input.invoice.terms, {
        width: pageWidth,
      });
    }

    // Footer with ORYNO company details
    const footerTop = doc.page.height - 72;
    doc
      .moveTo(48, footerTop)
      .lineTo(48 + pageWidth, footerTop)
      .strokeColor("#E5E7EB")
      .stroke();
    doc.fillColor(orange).fontSize(10).text(ORYNO_INVOICE_COMPANY.name, 48, footerTop + 10);
    doc
      .fillColor(muted)
      .fontSize(8)
      .text(ORYNO_INVOICE_COMPANY.tagline, 48, footerTop + 24);
    doc.text(
      `${ORYNO_INVOICE_COMPANY.website}  ·  ${ORYNO_INVOICE_COMPANY.email}`,
      48,
      footerTop + 36,
    );
    doc.text(INVOICE_FOOTER, 48, footerTop + 48, { width: pageWidth });

    doc.end();
  });
}
