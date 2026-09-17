import { escapeHtml } from "@/lib/email/template";

export function withdrawalSuccessfulEmailContent(input: {
  amountFormatted: string;
  reference: string;
}) {
  const amount = input.amountFormatted.trim();
  const reference = input.reference.trim();

  const bodyPlain = [
    "Your withdrawal request has been successfully processed. The funds have been sent to your selected account.",
    "",
    `Amount: ${amount}`,
    "Status: Completed ✅",
    `Reference: ${reference}`,
    "",
    "Thank you for using ORYNO — Your Digital World, Simplified.",
  ].join("\n");

  const bodyHtml = `
    <p style="margin:0 0 12px;">Your withdrawal request has been successfully processed. The funds have been sent to your selected account.</p>
    <table role="presentation" cellspacing="0" cellpadding="0" style="margin:16px 0;width:100%;background:#f9f7f4;border:1px solid #ebe6e0;border-radius:14px;">
      <tr>
        <td style="padding:14px 16px;font-size:14px;line-height:1.6;color:#3a3a3c;">
          <p style="margin:0 0 8px;"><strong style="color:#1c1c1e;">Amount:</strong> ${escapeHtml(amount)}</p>
          <p style="margin:0 0 8px;"><strong style="color:#1c1c1e;">Status:</strong> Completed ✅</p>
          <p style="margin:0;"><strong style="color:#1c1c1e;">Reference:</strong> ${escapeHtml(reference)}</p>
        </td>
      </tr>
    </table>
    <p style="margin:0;">Thank you for using ORYNO — Your Digital World, Simplified..</p>
  `;

  return {
    subject: "Withdrawal Successful 🎉",
    title: "Withdrawal Successful 🎉",
    preheader: `${amount} has been sent to your account.`,
    bodyPlain,
    bodyHtml,
  };
}
