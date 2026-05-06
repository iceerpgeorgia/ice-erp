import { getAttachmentDownloadUrl } from '@/lib/attachments';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

interface PaymentNotificationData {
  paymentId: string;
  label?: string | null;
  uploaderUserId?: string | null;
}

interface NotificationResult {
  success: boolean;
  notifiedUsers: string[];
  errors: string[];
}

type EmailAttachmentLink = {
  fileName: string;
  documentTypeName: string | null;
  fileSizeBytes: number | null;
  directUrl: string | null;
};

/**
 * Generate a secure token for payment attachment access
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

function normalizeBaseUrl(value?: string): string | null {
  const normalized = value?.trim();

  if (!normalized) {
    return null;
  }

  return normalized.replace(/\/+$/, '');
}

function getNotificationAppUrl(): string {
  return (
    normalizeBaseUrl(process.env.NEXTAUTH_URL) ||
    normalizeBaseUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    'http://localhost:3000'
  );
}

function formatAttachmentSize(fileSizeBytes: number | null): string {
  if (!fileSizeBytes) {
    return '';
  }

  return `${(Number(fileSizeBytes) / 1024).toFixed(1)} KB`;
}

/**
 * Send payment notifications when an attachment is uploaded.
 * Recipients: users with paymentNotifications=true + the uploader (deduplicated).
 */
export async function sendPaymentNotifications(
  payment: PaymentNotificationData
): Promise<NotificationResult> {
  console.log('[Payment Notifications] ================================================');
  console.log('[Payment Notifications] Starting notification process');
  console.log('[Payment Notifications] Payment ID:', payment.paymentId);
  console.log('[Payment Notifications] Uploader User ID:', payment.uploaderUserId || 'N/A');
  console.log('[Payment Notifications] ================================================');

  const result: NotificationResult = {
    success: true,
    notifiedUsers: [],
    errors: [],
  };

  try {
    // ── 1. Collect recipients ─────────────────────────────────────────────────
    const notifUsers = await prisma.user.findMany({
      where: { paymentNotifications: true, isAuthorized: true, email: { not: null } },
      select: { id: true, email: true, name: true, counteragentUuid: true },
    });

    // Fetch uploader separately (may or may not have notifications enabled)
    let uploaderUser: { id: string; email: string | null; name: string | null; counteragentUuid: string | null } | null = null;
    if (payment.uploaderUserId) {
      uploaderUser = await prisma.user.findUnique({
        where: { id: payment.uploaderUserId },
        select: { id: true, email: true, name: true, counteragentUuid: true },
      });
    }

    // Deduplicate: start with notification users, then add uploader if not already there
    const recipientMap = new Map<string, { id: string; email: string; name: string | null; counteragentUuid: string | null }>();
    for (const u of notifUsers) {
      if (u.email) recipientMap.set(u.id, { id: u.id, email: u.email, name: u.name, counteragentUuid: u.counteragentUuid ?? null });
    }
    if (uploaderUser?.email && !recipientMap.has(uploaderUser.id)) {
      recipientMap.set(uploaderUser.id, {
        id: uploaderUser.id,
        email: uploaderUser.email,
        name: uploaderUser.name,
        counteragentUuid: uploaderUser.counteragentUuid ?? null,
      });
    }
    const recipients = Array.from(recipientMap.values());

    console.log('[Payment Notifications] Recipients:', recipients.map(u => u.email).join(', ') || 'none');

    if (recipients.length === 0) {
      console.log('[Payment Notifications] No recipients — skipping');
      return result;
    }

    // ── 2. Load payment with joins ────────────────────────────────────────────
    const paymentRecord = await prisma.payments.findUnique({
      where: { payment_id: payment.paymentId },
      select: {
        payment_id: true,
        record_uuid: true,
        label: true,
        project_uuid: true,
        counteragent_uuid: true,
        currency_uuid: true,
      },
    });

    if (!paymentRecord) {
      throw new Error(`Payment not found: ${payment.paymentId}`);
    }

    const paymentLabel = payment.label ?? paymentRecord.label;

    // ── 3. Look up related entities in parallel ───────────────────────────────
    const [projectRow, counteragentRow, currencyRow] = await Promise.all([
      paymentRecord.project_uuid
        ? prisma.projects.findFirst({
            where: { project_uuid: paymentRecord.project_uuid },
            select: { project_index: true, project_name: true },
          })
        : Promise.resolve(null),
      prisma.counteragents.findFirst({
        where: { counteragent_uuid: paymentRecord.counteragent_uuid },
        select: { counteragent: true, name: true, insider_name: true },
      }),
      prisma.currencies.findFirst({
        where: { uuid: paymentRecord.currency_uuid },
        select: { code: true },
      }),
    ]);

    const projectLabel = projectRow?.project_index || projectRow?.project_name || '—';
    const counteragentLabel = counteragentRow?.counteragent || counteragentRow?.name || '—';
    const insiderName = (counteragentRow as any)?.insider_name || null;
    const currencyCode = currencyRow?.code || '';

    // ── 4. Attachments for this payment ───────────────────────────────────────
    const attachments = await prisma.attachments.findMany({
      where: {
        links: { some: { owner_table: 'payments', owner_uuid: paymentRecord.record_uuid } },
        is_active: true,
      },
      select: {
        uuid: true,
        file_name: true,
        mime_type: true,
        file_size_bytes: true,
        storage_bucket: true,
        storage_path: true,
        document_value: true,
        document_type: { select: { name: true } },
      },
    });

    if (attachments.length === 0) {
      console.log('[Payment Notifications] No attachments — skipping');
      return result;
    }

    // Sum of document values from attachments (as "თანხა")
    const attachmentSum = attachments.reduce((acc, a) => {
      return acc + (a.document_value ? parseFloat(String(a.document_value)) : 0);
    }, 0);
    const attachmentSumDisplay = attachmentSum !== 0
      ? `${attachmentSum.toLocaleString('ka-GE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`
      : '—';

    // ── 5. Payment due (order − |bank payments|) ─────────────────────────────
    let dueDisplay = '—';
    try {
      const dueRows = await prisma.$queryRawUnsafe<Array<{ total_order: string; total_payment: string }>>(
        `SELECT
           COALESCE(SUM(pl."order"), 0)::text AS total_order,
           ABS(COALESCE((
             SELECT SUM(cba.nominal_amount)
             FROM consolidated_bank_accounts cba
             WHERE cba.payment_id = $1
           ), 0))::text AS total_payment
         FROM payments_ledger pl
         WHERE pl.payment_id = $1 AND pl.is_deleted = false`,
        payment.paymentId
      );
      if (dueRows.length > 0) {
        const due = parseFloat(dueRows[0].total_order) - parseFloat(dueRows[0].total_payment);
        dueDisplay = `${due.toLocaleString('ka-GE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currencyCode}`;
      }
    } catch (e) {
      console.warn('[Payment Notifications] Could not calculate due:', e);
    }

    // ── 6. Uploader's counteragent name (responsible) ─────────────────────────
    let responsibleLabel = '—';
    const uploaderCaUuid = uploaderUser?.counteragentUuid ?? null;
    if (uploaderCaUuid) {
      const uploaderCa = await prisma.counteragents.findFirst({
        where: { counteragent_uuid: uploaderCaUuid },
        select: { counteragent: true, name: true },
      });
      responsibleLabel = uploaderCa?.counteragent || uploaderCa?.name || uploaderUser?.name || '—';
    } else if (uploaderUser?.name) {
      responsibleLabel = uploaderUser.name;
    }

    // ── 7. Build signed attachment links ─────────────────────────────────────
    const APP_URL = getNotificationAppUrl();
    const emailAttachmentLinks: EmailAttachmentLink[] = await Promise.all(
      attachments.map(async (attachment) => {
        try {
          const directUrl = await getAttachmentDownloadUrl(
            attachment.storage_bucket || 'payment-attachments',
            attachment.storage_path,
            60 * 60 * 24 * 30,
          );
          return {
            fileName: attachment.file_name,
            documentTypeName: attachment.document_type?.name || null,
            fileSizeBytes: attachment.file_size_bytes ? Number(attachment.file_size_bytes) : null,
            directUrl,
          };
        } catch {
          return {
            fileName: attachment.file_name,
            documentTypeName: attachment.document_type?.name || null,
            fileSizeBytes: attachment.file_size_bytes ? Number(attachment.file_size_bytes) : null,
            directUrl: null,
          };
        }
      })
    );

    // ── 8. Send to each recipient ─────────────────────────────────────────────
    for (const user of recipients) {
      try {
        const token = generateSecureToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);

        await prisma.paymentNotificationToken.create({
          data: { token, userId: user.id, paymentId: payment.paymentId, expiresAt },
        });

        const publicLink = `${APP_URL}/api/public/payment-attachments?token=${token}`;

        const emailData = buildEmail({
          to: user.email,
          paymentId: payment.paymentId,
          paymentLabel,
          projectLabel,
          counteragentLabel,
          insiderName,
          attachmentSumDisplay,
          dueDisplay,
          responsibleLabel,
          currencyCode,
          emailAttachmentLinks,
          publicLink,
        });

        await sendEmail(emailData);
        console.log('[Payment Notifications] ✓ Email sent to:', user.email);
        result.notifiedUsers.push(user.email);
      } catch (error: any) {
        console.error('[Payment Notifications] ✗ Failed to notify:', user.email, error?.message);
        result.errors.push(`Failed to notify ${user.email}: ${error?.message || 'Unknown error'}`);
        result.success = false;
      }
    }

    return result;
  } catch (error: any) {
    console.error('[Payment Notifications] FATAL ERROR:', error?.message);
    result.success = false;
    result.errors.push(`Fatal error: ${error?.message || 'Unknown error'}`);
    return result;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Email builder
// ─────────────────────────────────────────────────────────────────────────────

function buildEmail(ctx: {
  to: string;
  paymentId: string;
  paymentLabel: string | null | undefined;
  projectLabel: string;
  counteragentLabel: string;
  insiderName: string | null;
  attachmentSumDisplay: string;
  dueDisplay: string;
  responsibleLabel: string;
  currencyCode: string;
  emailAttachmentLinks: EmailAttachmentLink[];
  publicLink: string;
}): { to: string; subject: string; text: string; html: string } {
  const subject = ctx.paymentLabel
    ? `ახალი გადახდა: ${ctx.paymentLabel}`
    : `ახალი გადახდა: ${ctx.paymentId}`;

  // ── Plain-text ────────────────────────────────────────────────────────────
  const attachmentLines = ctx.emailAttachmentLinks
    .map((att, i) => {
      const meta = [att.documentTypeName, formatAttachmentSize(att.fileSizeBytes)].filter(Boolean).join(' – ');
      const link = att.directUrl ? att.directUrl : ctx.publicLink;
      return `${i + 1}. ${att.fileName}${meta ? ` (${meta})` : ''}\n   ${link}`;
    })
    .join('\n');

  const text = [
    'მოგესალმებით,',
    '',
    'გაცნობებთ, რომ დაემატა ახალი გადახდა:',
    '',
    `პროექტი           : ${ctx.projectLabel}`,
    `კონტრაგენტი       : ${ctx.counteragentLabel}`,
    ...(ctx.insiderName ? [`გადამხდელი        : ${ctx.insiderName}`] : []),
    `თანხა             : ${ctx.attachmentSumDisplay}`,
    `გადახდის ნაშთი    : ${ctx.dueDisplay}`,
    `პასუხისმგებელი    : ${ctx.responsibleLabel}`,
    '',
    'დანართები:',
    attachmentLines || '—',
    '',
    `ყველა დანართის სანახავად: ${ctx.publicLink}`,
    '',
    '(ბმული მოქმედია 30 დღის განმავლობაში)',
  ].join('\n');

  // ── HTML ──────────────────────────────────────────────────────────────────
  const attachmentRows = ctx.emailAttachmentLinks
    .map((att, i) => {
      const meta = [att.documentTypeName, formatAttachmentSize(att.fileSizeBytes)].filter(Boolean).join(' – ');
      const link = att.directUrl ?? ctx.publicLink;
      return `
      <tr>
        <td style="padding:10px 12px;border-bottom:1px solid #e5e7eb;font-size:14px;color:#111827;">
          <span style="color:#6b7280;margin-right:6px;">${i + 1}.</span>
          <a href="${link}" style="color:#2563eb;text-decoration:none;font-weight:500;">${escapeHtml(att.fileName)}</a>
          ${meta ? `<span style="color:#9ca3af;font-size:12px;margin-left:8px;">${escapeHtml(meta)}</span>` : ''}
        </td>
      </tr>`;
    })
    .join('');

  const infoRows: [string, string][] = [
    ['პროექტი', ctx.projectLabel],
    ['კონტრაგენტი', ctx.counteragentLabel],
    ...(ctx.insiderName ? [['გადამხდელი', ctx.insiderName] as [string, string]] : []),
    ['თანხა', ctx.attachmentSumDisplay],
    ['გადახდის ნაშთი', ctx.dueDisplay],
    ['პასუხისმგებელი', ctx.responsibleLabel],
  ];

  const infoHtml = infoRows
    .map(([label, value], idx) => `
    <tr style="background:${idx % 2 === 0 ? '#f9fafb' : '#ffffff'};">
      <td style="padding:10px 16px;font-size:13px;color:#6b7280;font-weight:600;white-space:nowrap;width:160px;">${escapeHtml(label)}</td>
      <td style="padding:10px 16px;font-size:14px;color:#111827;">${escapeHtml(value)}</td>
    </tr>`)
    .join('');

  const html = `<!DOCTYPE html>
<html lang="ka">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${escapeHtml(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#1e40af 0%,#3b82f6 100%);padding:28px 32px;">
            <p style="margin:0 0 4px;font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#93c5fd;">გადახდის სისტემა</p>
            <h1 style="margin:0;font-size:22px;font-weight:700;color:#ffffff;">ახალი გადახდა დაემატა</h1>
          </td>
        </tr>

        <!-- Greeting -->
        <tr>
          <td style="padding:24px 32px 8px;">
            <p style="margin:0;font-size:15px;color:#374151;">მოგესალმებით,</p>
            <p style="margin:8px 0 0;font-size:15px;color:#374151;">გაცნობებთ, რომ სისტემაში დაემატა ახალი გადახდა:</p>
          </td>
        </tr>

        <!-- Payment info table -->
        <tr>
          <td style="padding:16px 32px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
              ${infoHtml}
            </table>
          </td>
        </tr>

        <!-- Attachments -->
        ${ctx.emailAttachmentLinks.length > 0 ? `
        <tr>
          <td style="padding:0 32px 8px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">დანართები</p>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-radius:8px;overflow:hidden;border:1px solid #e5e7eb;">
              ${attachmentRows}
            </table>
          </td>
        </tr>` : ''}

        <!-- CTA button -->
        <tr>
          <td style="padding:20px 32px 8px;" align="center">
            <a href="${ctx.publicLink}"
               style="display:inline-block;background:#2563eb;color:#ffffff;text-decoration:none;padding:12px 28px;border-radius:8px;font-size:15px;font-weight:600;">
              ყველა დანართის ნახვა
            </a>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:16px 32px 28px;text-align:center;">
            <p style="margin:0;font-size:12px;color:#9ca3af;">ბმული მოქმედია 30 დღის განმავლობაში &bull; ავტომატური შეტყობინება</p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  return { to: ctx.to, subject, text, html };
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}



/**
 * Send email using Gmail API with Service Account JSON or Gmail SMTP
 */
async function sendEmail(emailData: {
  to: string;
  subject: string;
  text: string;
  html: string;
}) {
  console.log('[Email Service] ============================================');
  console.log('[Email Service] Starting email send process');
  console.log('[Email Service] To:', emailData.to);
  console.log('[Email Service] Subject:', emailData.subject);
  console.log('[Email Service] ============================================');
  
  try {
    const nodemailer = await import('nodemailer');
    console.log('[Email Service] Nodemailer loaded successfully');
    let serviceAccountFailure: Error | null = null;
    
    // Option 1: Google Service Account JSON (preferred if available)
    const googleCredentialsPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    const serviceAccountJson = process.env.SERVICE_ACCOUNT_JSON;
    const gmailSenderEmail = process.env.GMAIL_SENDER_EMAIL || process.env.GMAIL_USER;
    
    console.log('[Email Service] Checking Service Account credentials...');
    console.log('[Email Service] - GOOGLE_APPLICATION_CREDENTIALS:', googleCredentialsPath ? `✓ (${googleCredentialsPath})` : '✗ not set');
    console.log('[Email Service] - SERVICE_ACCOUNT_JSON:', serviceAccountJson ? '✓ set' : '✗ not set');
    console.log('[Email Service] - GMAIL_SENDER_EMAIL:', gmailSenderEmail ? `✓ (${gmailSenderEmail})` : '✗ not set');
    
    if ((googleCredentialsPath || serviceAccountJson) && gmailSenderEmail) {
      console.log('[Email Service] Using Service Account method');
      
      try {
        let credentials: any;

        if (serviceAccountJson) {
          console.log('[Email Service] Loading service account credentials from SERVICE_ACCOUNT_JSON');
          credentials = JSON.parse(serviceAccountJson);
        } else {
          const { readFileSync } = await import('fs');
          console.log('[Email Service] Reading service account file:', googleCredentialsPath);
          
          const fileContent = readFileSync(googleCredentialsPath!, 'utf-8');
          console.log('[Email Service] Service account file read successfully, size:', fileContent.length, 'bytes');
          credentials = JSON.parse(fileContent);
        }

        console.log('[Email Service] Service account JSON parsed successfully');
        console.log('[Email Service] - client_email:', credentials.client_email);
        console.log('[Email Service] - project_id:', credentials.project_id);
        console.log('[Email Service] - client_id:', credentials.client_id);
        console.log('[Email Service] - private_key:', credentials.private_key ? `✓ (${credentials.private_key.length} chars)` : '✗ missing');
        
        console.log('[Email Service] Creating transporter with OAuth2...');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            type: 'OAuth2',
            user: gmailSenderEmail,
            serviceClient: credentials.client_id,
            privateKey: credentials.private_key,
          },
        });
        console.log('[Email Service] Transporter created successfully');

        console.log('[Email Service] Sending email...');
        const result = await transporter.sendMail({
          from: `"Payment Notifications" <${gmailSenderEmail}>`,
          to: emailData.to,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html,
        });

        console.log('[Email Service] ✓ Email sent via Service Account successfully!');
        console.log('[Email Service] Message ID:', result.messageId);
        console.log('[Email Service] Response:', result.response);
        return;
      } catch (serviceAccountError: any) {
        console.error('[Email Service] ✗ Service Account method failed');
        console.error('[Email Service] Error name:', serviceAccountError.name);
        console.error('[Email Service] Error message:', serviceAccountError.message);
        console.error('[Email Service] Error code:', serviceAccountError.code);
        console.error('[Email Service] Full error:', serviceAccountError);
        console.error('[Email Service] Stack trace:', serviceAccountError.stack);
        serviceAccountFailure = serviceAccountError instanceof Error
          ? serviceAccountError
          : new Error(serviceAccountError?.message || 'Unknown service account error');
        console.warn('[Email Service] Falling back to SMTP if SMTP credentials are configured');
      }
    }
    
    // Option 2: Gmail SMTP with App Password (fallback)
    const gmailUser = process.env.GMAIL_USER;
    const gmailAppPassword = process.env.GMAIL_APP_PASSWORD;
    
    console.log('[Email Service] Checking SMTP credentials...');
    console.log('[Email Service] - GMAIL_USER:', gmailUser ? `✓ (${gmailUser})` : '✗ not set');
    console.log('[Email Service] - GMAIL_APP_PASSWORD:', gmailAppPassword ? `✓ (${gmailAppPassword.length} chars)` : '✗ not set');
    
    if (gmailUser && gmailAppPassword) {
      console.log('[Email Service] Using SMTP method');
      
      try {
        console.log('[Email Service] Creating SMTP transporter...');
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: gmailUser,
            pass: gmailAppPassword,
          },
        });
        console.log('[Email Service] SMTP transporter created successfully');

        console.log('[Email Service] Sending email via SMTP...');
        const result = await transporter.sendMail({
          from: `"Payment Notifications" <${gmailUser}>`,
          to: emailData.to,
          subject: emailData.subject,
          text: emailData.text,
          html: emailData.html,
        });

        console.log('[Email Service] ✓ Email sent via SMTP successfully!');
        console.log('[Email Service] Message ID:', result.messageId);
        console.log('[Email Service] Response:', result.response);
        return;
      } catch (smtpError: any) {
        console.error('[Email Service] ✗ SMTP method failed');
        console.error('[Email Service] Error name:', smtpError.name);
        console.error('[Email Service] Error message:', smtpError.message);
        console.error('[Email Service] Error code:', smtpError.code);
        console.error('[Email Service] Full error:', smtpError);
        console.error('[Email Service] Stack trace:', smtpError.stack);
        throw smtpError;
      }
    }
    
    if (serviceAccountFailure) {
      throw serviceAccountFailure;
    }

    throw new Error(
      'No email credentials configured. Configure SERVICE_ACCOUNT_JSON and GMAIL_SENDER_EMAIL, GOOGLE_APPLICATION_CREDENTIALS and GMAIL_SENDER_EMAIL, or GMAIL_USER and GMAIL_APP_PASSWORD.'
    );
    
  } catch (error: any) {
    console.error('[Email Service] ============================================');
    console.error('[Email Service] FATAL ERROR sending email');
    console.error('[Email Service] To:', emailData.to);
    console.error('[Email Service] Subject:', emailData.subject);
    console.error('[Email Service] Error type:', typeof error);
    console.error('[Email Service] Error name:', error?.name);
    console.error('[Email Service] Error message:', error?.message);
    console.error('[Email Service] Error code:', error?.code);
    console.error('[Email Service] Error stack:', error?.stack);
    console.error('[Email Service] Full error object:', error);
    console.error('[Email Service] ============================================');
    throw error;
  }
}
