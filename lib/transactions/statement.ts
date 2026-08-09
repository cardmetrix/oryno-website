import { and, asc, eq, gte, lt } from "drizzle-orm";
import ExcelJS from "exceljs";
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";

import { appBaseUrl } from "@/lib/email/client";
import { sendBrandedEmail } from "@/lib/email/send";
import { db } from "@/lib/db";
import { transactions } from "@/lib/db/schema";
import {
  formatMoney,
  toAppTransaction,
  type AppTransaction,
} from "@/lib/transactions";


/** Bundled TTF so PDFKit never needs missing Helvetica.afm in production. */
function statementFontPath() {
  const candidates = [
    path.join(process.cwd(), "assets/fonts/NotoSans-Regular.ttf"),
    path.join(process.cwd(), "vendor/fonts/NotoSans-Regular.ttf"),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) return candidate;
  }
  return candidates[0];
}

/**
 * If a deploy stripped pdfkit's AFM metrics, restore them from vendored copies.
 * No-op on read-only filesystems; the custom TTF path is the primary fix.
 */
function ensurePdfkitAfmData() {
  try {
    const vendorDir = path.join(process.cwd(), "vendor/pdfkit-data");
    if (!fs.existsSync(vendorDir)) return;

    const dataDirs = [
      path.join(process.cwd(), "node_modules/pdfkit/js/data"),
    ];
    try {
      const pnpmDir = path.join(process.cwd(), "node_modules/.pnpm");
      if (fs.existsSync(pnpmDir)) {
        for (const entry of fs.readdirSync(pnpmDir)) {
          if (!entry.startsWith("pdfkit@")) continue;
          dataDirs.push(
            path.join(pnpmDir, entry, "node_modules/pdfkit/js/data"),
          );
        }
      }
    } catch {
      // ignore
    }

    for (const dataDir of dataDirs) {
      const marker = path.join(dataDir, "Helvetica.afm");
      if (fs.existsSync(marker)) continue;
      if (!fs.existsSync(path.dirname(dataDir))) continue;
      fs.mkdirSync(dataDir, { recursive: true });
      for (const file of fs.readdirSync(vendorDir)) {
        if (!file.endsWith(".afm") && !file.endsWith(".icc")) continue;
        fs.copyFileSync(path.join(vendorDir, file), path.join(dataDir, file));
      }
    }
  } catch {
    // Ignore — custom font path still used below.
  }
}

export type StatementFormat = "pdf" | "xlsx";

type StatementUser = {
  id: string;
  email: string;
  fullName: string | null;
};

export type StatementRequest = {
  format: StatementFormat;
  month?: string | null; // YYYY-MM
};

function parseMonth(month?: string | null) {
  const now = new Date();
  const key =
    month && /^\d{4}-\d{2}$/.test(month)
      ? month
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [yearStr, monthStr] = key.split("-");
  const year = Number(yearStr);
  const monthIndex = Number(monthStr) - 1;
  const start = new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, monthIndex + 1, 1, 0, 0, 0, 0));
  const label = start.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
  return { key, start, end, label };
}

function summarize(items: AppTransaction[]) {
  let inflow = 0;
  let outflow = 0;
  for (const item of items) {
    const n = Math.abs(Number(String(item.amount).replace(/[^\d.-]/g, "")) || 0);
    if (item.type === "credit") inflow += n;
    else outflow += n;
  }
  return { inflow, outflow, net: inflow - outflow, count: items.length };
}

async function loadMonthTransactions(userId: string, start: Date, end: Date) {
  const rows = await db.query.transactions.findMany({
    where: and(
      eq(transactions.userId, userId),
      gte(transactions.createdAt, start),
      lt(transactions.createdAt, end),
    ),
    orderBy: [asc(transactions.createdAt)],
    limit: 2000,
  });
  return rows.map(toAppTransaction);
}

async function buildPdfBuffer(opts: {
  user: StatementUser;
  periodLabel: string;
  monthKey: string;
  items: AppTransaction[];
}) {
  const summary = summarize(opts.items);
  const currency = opts.items[0]?.currency ?? "NGN";

  ensurePdfkitAfmData();
  const fontPath = statementFontPath();
  if (!fs.existsSync(fontPath)) {
    throw new Error(
      "Statement font is missing from the server bundle. Redeploy after including assets/fonts.",
    );
  }

  const doc = new PDFDocument({
    margin: 48,
    size: "A4",
    font: fontPath,
    info: {
      Title: `ORYNO Statement ${opts.monthKey}`,
      Author: "ORYNO",
      Subject: `Wallet statement for ${opts.periodLabel}`,
    },
  });

  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(Buffer.from(chunk)));

  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  doc.fillColor("#FF6A00").fontSize(22).text("ORYNO");
  doc.fillColor("#1C1C1E").fontSize(16).text("Wallet statement");
  doc.moveDown(0.4);
  doc.fillColor("#8E8E93").fontSize(11);
  doc.text(`Account holder: ${opts.user.fullName || "ORYNO customer"}`);
  doc.text(`Email: ${opts.user.email}`);
  doc.text(`Period: ${opts.periodLabel}`);
  doc.text(`Generated: ${new Date().toLocaleString("en-NG")}`);
  doc.moveDown();

  doc.fillColor("#1C1C1E").fontSize(12).text("Summary", { underline: true });
  doc.moveDown(0.3);
  doc.fontSize(11);
  doc.text(`In: ${formatMoney(summary.inflow, currency)}`);
  doc.text(`Out: ${formatMoney(summary.outflow, currency)}`);
  doc.text(`Net: ${formatMoney(summary.net, currency)}`);
  doc.text(`Transactions: ${summary.count}`);
  doc.moveDown();

  doc.fontSize(12).text("Transactions", { underline: true });
  doc.moveDown(0.4);

  if (!opts.items.length) {
    doc.fillColor("#8E8E93").fontSize(11).text("No transactions in this period.");
  } else {
    for (const item of opts.items) {
      const date = new Date(item.createdAt).toLocaleString("en-NG", {
        dateStyle: "medium",
        timeStyle: "short",
      });
      doc.fillColor("#1C1C1E").fontSize(11).text(item.title, { continued: true });
      doc.fillColor(item.type === "credit" ? "#34C759" : "#1C1C1E").text(`  ${item.amount}`, {
        align: "right",
      });
      doc
        .fillColor("#8E8E93")
        .fontSize(9)
        .text(`${date} · ${item.subtitle} · ${item.status} · ${item.category ?? "other"}`);
      doc.moveDown(0.35);
      if (doc.y > 760) doc.addPage();
    }
  }

  doc.moveDown();
  doc
    .fillColor("#8E8E93")
    .fontSize(9)
    .text(
      "This statement was generated by ORYNO for your records. Keep it for reconciliation and support requests.",
      { align: "left" },
    );

  doc.end();
  return done;
}

async function buildXlsxBuffer(opts: {
  user: StatementUser;
  periodLabel: string;
  monthKey: string;
  items: AppTransaction[];
}) {
  const summary = summarize(opts.items);
  const currency = opts.items[0]?.currency ?? "NGN";
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "ORYNO";
  workbook.created = new Date();

  const cover = workbook.addWorksheet("Summary");
  cover.getColumn(1).width = 28;
  cover.getColumn(2).width = 36;
  cover.addRow(["ORYNO Wallet Statement"]);
  cover.getRow(1).font = { bold: true, size: 14, color: { argb: "FFFF6A00" } };
  cover.addRow(["Account holder", opts.user.fullName || "ORYNO customer"]);
  cover.addRow(["Email", opts.user.email]);
  cover.addRow(["Period", opts.periodLabel]);
  cover.addRow(["Generated", new Date().toISOString()]);
  cover.addRow([]);
  cover.addRow(["In", formatMoney(summary.inflow, currency)]);
  cover.addRow(["Out", formatMoney(summary.outflow, currency)]);
  cover.addRow(["Net", formatMoney(summary.net, currency)]);
  cover.addRow(["Transactions", summary.count]);

  const sheet = workbook.addWorksheet("Transactions");
  sheet.columns = [
    { header: "Date", key: "date", width: 14 },
    { header: "Time", key: "time", width: 10 },
    { header: "Title", key: "title", width: 28 },
    { header: "Details", key: "details", width: 28 },
    { header: "Category", key: "category", width: 16 },
    { header: "Type", key: "type", width: 10 },
    { header: "Status", key: "status", width: 12 },
    { header: "Amount", key: "amount", width: 14 },
    { header: "Currency", key: "currency", width: 10 },
    { header: "Transaction ID", key: "id", width: 38 },
  ];
  sheet.getRow(1).font = { bold: true };
  sheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFFFE8D6" },
  };

  for (const item of opts.items) {
    const date = new Date(item.createdAt);
    const amount = Number(String(item.amount).replace(/[^\d.-]/g, "")) || 0;
    sheet.addRow({
      date: Number.isNaN(date.getTime()) ? item.createdAt : date.toISOString().slice(0, 10),
      time: Number.isNaN(date.getTime())
        ? ""
        : date.toLocaleTimeString("en-GB", { hour12: false }),
      title: item.title,
      details: item.subtitle,
      category: item.category ?? "other",
      type: item.type,
      status: item.status,
      amount: item.type === "credit" ? Math.abs(amount) : -Math.abs(amount),
      currency: (item.currency ?? currency).toUpperCase(),
      id: item.id,
    });
  }

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export async function emailWalletStatement(
  user: StatementUser,
  input: StatementRequest,
) {
  if (!user.email?.trim()) {
    throw new Error("Your account has no email address on file.");
  }

  const format: StatementFormat = input.format === "xlsx" ? "xlsx" : "pdf";
  const period = parseMonth(input.month);
  const items = await loadMonthTransactions(user.id, period.start, period.end);

  const fileBuffer =
    format === "xlsx"
      ? await buildXlsxBuffer({
          user,
          periodLabel: period.label,
          monthKey: period.key,
          items,
        })
      : await buildPdfBuffer({
          user,
          periodLabel: period.label,
          monthKey: period.key,
          items,
        });

  const filename =
    format === "xlsx"
      ? `ORYNO-statement-${period.key}.xlsx`
      : `ORYNO-statement-${period.key}.pdf`;
  const contentType =
    format === "xlsx"
      ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      : "application/pdf";

  const summary = summarize(items);
  const currency = items[0]?.currency ?? "NGN";
  const name = user.fullName?.trim() || "there";

  const result = await sendBrandedEmail({
    to: user.email,
    subject: `Your ORYNO statement — ${period.label}`,
    title: `Wallet statement · ${period.label}`,
    preheader: `Your ${format.toUpperCase()} statement is attached.`,
    body: [
      `Hi ${name},`,
      `Your ORYNO wallet statement for ${period.label} is attached as a ${format === "xlsx" ? "Excel spreadsheet" : "PDF document"}.`,
      `Summary: In ${formatMoney(summary.inflow, currency)} · Out ${formatMoney(summary.outflow, currency)} · ${summary.count} transaction${summary.count === 1 ? "" : "s"}.`,
      "Keep this file for your records. If anything looks off, reply to this email or contact support from the app.",
    ].join("\n\n"),
    cta: {
      label: "Open transaction history",
      href: `${appBaseUrl()}/history`,
    },
    footerNote: "This message was sent because you requested a bank statement from ORYNO.",
    attachments: [
      {
        filename,
        content: fileBuffer,
        contentType,
      },
    ],
  });

  if (!result.ok) {
    throw new Error(
      "Email delivery is temporarily unavailable. Please try again shortly.",
    );
  }

  return {
    ok: true as const,
    emailedTo: user.email,
    month: period.key,
    periodLabel: period.label,
    format,
    filename,
    count: items.length,
    messageId: result.id,
  };
}
