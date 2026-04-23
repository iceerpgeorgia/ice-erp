import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

interface PaymentNotificationData {
  paymentId: string;
  label?: string | null;
}

interface NotificationResult {
  success: boolean;
  notifiedUsers: string[];
  errors: string[];
}

/**
 * Generate a secure token for payment attachment access
 */
function generateSecureToken(): string {
  return crypto.randomBytes(32).toString('base64url');
}

/**
 * Send payment notifications to all users with paymentNotifications enabled
 */
export async function sendPaymentNotifications(
  payment: PaymentNotificationData
): Promise<NotificationResult> {
  console.log('[Payment Notifications] ================================================');
  console.log('[Payment Notifications] Starting notification process');
  console.log('[Payment Notifications] Payment ID:', payment.paymentId);
  console.log('[Payment Notifications] Payment Label:', payment.label || 'N/A');
  console.log('[Payment Notifications] ================================================');
  
  const result: NotificationResult = {
    success: true,
    notifiedUsers: [],
    errors: [],
  };

  try {
    console.log('[Payment Notifications] Querying users with notifications enabled...');
    
    // Get all users with payment notifications enabled
    const users = await prisma.user.findMany({
      where: {
        paymentNotifications: true,
        isAuthorized: true,
        email: {
          not: null,
        },
      },
      select: {
        id: true,
        email: true,
        name: true,
      },
    });

    console.log('[Payment Notifications] Found', users.length, 'eligible users');
    if (users.length > 0) {
      console.log('[Payment Notifications] Users:', users.map(u => u.email).join(', '));
    }

    if (users.length === 0) {
      console.log('[Payment Notifications] No users with notifications enabled - skipping email send');
      return result;
    }

    console.log('[Payment Notifications] Loading payment record...');
    const paymentRecord = await prisma.payments.findUnique({
      where: {
        payment_id: payment.paymentId,
      },
      select: {
        payment_id: true,
        record_uuid: true,
        label: true,
      },
    });

    if (!paymentRecord) {
      throw new Error(`Payment not found for notification: ${payment.paymentId}`);
    }

    const paymentLabel = payment.label ?? paymentRecord.label;

    console.log('[Payment Notifications] Fetching payment attachments...');
    
    // Get attachments for the payment
    const attachments = await prisma.attachments.findMany({
      where: {
        links: {
          some: {
            owner_table: 'payments',
            owner_uuid: paymentRecord.record_uuid,
          },
        },
        is_active: true,
      },
      select: {
        uuid: true,
        file_name: true,
        mime_type: true,
        file_size_bytes: true,
        document_type: {
          select: {
            name: true,
          },
        },
      },
    });

    console.log('[Payment Notifications] Found', attachments.length, 'attachments for this payment');
    if (attachments.length > 0) {
      console.log('[Payment Notifications] Attachments:', attachments.map(a => a.file_name).join(', '));
    }

    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000';
    console.log('[Payment Notifications] App URL:', APP_URL);
  console.log('[Payment Notifications] Attachment Count:', attachments.length);

    console.log('[Payment Notifications] Starting to send emails to', users.length, 'users...');
    
    // Send notification to each user
    for (let i = 0; i < users.length; i++) {
      const user = users[i];
      console.log('[Payment Notifications] ----------------------------------------');
      console.log('[Payment Notifications] Processing user', (i + 1), 'of', users.length);
      console.log('[Payment Notifications] User:', user.email);
      console.log('[Payment Notifications] User ID:', user.id);
      console.log('[Payment Notifications] User Name:', user.name || 'N/A');
      
      try {
        console.log('[Payment Notifications] Generating secure token...');
        // Generate unique token for this user and payment (30 days expiry)
        const token = generateSecureToken();
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        console.log('[Payment Notifications] Token generated (length:', token.length, 'chars)');
        console.log('[Payment Notifications] Token expires:', expiresAt.toISOString());

        console.log('[Payment Notifications] Saving token to database...');
        // Save token to database
        await prisma.paymentNotificationToken.create({
          data: {
            token,
            userId: user.id,
            paymentId: payment.paymentId,
            expiresAt,
          },
        });
        console.log('[Payment Notifications] Token saved successfully');

        // Generate public link
        const publicLink = `${APP_URL}/api/public/payment-attachments?token=${token}`;
        console.log('[Payment Notifications] Public link generated:', publicLink);

        console.log('[Payment Notifications] Preparing email content...');
        // Prepare email content
        const emailData = {
          to: user.email!,
          subject: `New Payment Added: ${paymentLabel || payment.paymentId}`,
          text: `
Hello ${user.name || user.email},

A new payment has been added to the system:

Payment ID: ${payment.paymentId}
${paymentLabel ? `Label: ${paymentLabel}` : ''}
Attachments: ${attachments.length}

${attachments.length > 0 ? 'Attachment List:\n' + attachments.map((att, idx) => 
  `${idx + 1}. ${att.file_name} (${att.document_type?.name || 'No type'})${att.file_size_bytes ? ` - ${(Number(att.file_size_bytes) / 1024).toFixed(1)} KB` : ''}`
).join('\n') : 'No attachments available.'}

View and download attachments:
${publicLink}

This link is valid for 30 days and allows you to access payment attachments without logging in.

---
This is an automated notification from the Payment System.
          `.trim(),
          html: `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #4F46E5; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .payment-info { background: white; padding: 15px; margin: 15px 0; border-radius: 6px; border-left: 4px solid #4F46E5; }
    .attachments { background: white; padding: 15px; margin: 15px 0; border-radius: 6px; }
    .attachment-item { padding: 8px 0; border-bottom: 1px solid #e5e7eb; }
    .attachment-item:last-child { border-bottom: none; }
    .button { display: inline-block; background: #4F46E5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 15px 0; }
    .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2 style="margin: 0;">New Payment Added</h2>
    </div>
    <div class="content">
      <p>Hello ${user.name || user.email},</p>
      <p>A new payment has been added to the system:</p>
      
      <div class="payment-info">
        <strong>Payment ID:</strong> ${payment.paymentId}<br>
        ${paymentLabel ? `<strong>Label:</strong> ${paymentLabel}<br>` : ''}
        <strong>Attachments:</strong> ${attachments.length}
      </div>
      
      ${attachments.length > 0 ? `
        <div class="attachments">
          <h3 style="margin-top: 0;">Attachment List:</h3>
          ${attachments.map((att, idx) => `
            <div class="attachment-item">
              <strong>${idx + 1}.</strong> ${att.file_name}
              ${att.document_type?.name ? ` <span style="color: #6b7280;">(${att.document_type.name})</span>` : ''}
              ${att.file_size_bytes ? ` <span style="color: #6b7280;">- ${(Number(att.file_size_bytes) / 1024).toFixed(1)} KB</span>` : ''}
            </div>
          `).join('')}
        </div>
      ` : '<p style="color: #6b7280;"><em>No attachments available.</em></p>'}
      
      <a href="${publicLink}" class="button">View & Download Attachments</a>
      
      <p style="font-size: 12px; color: #6b7280;">
        This link is valid for 30 days and allows you to access payment attachments without logging in.
      </p>
    </div>
    <div class="footer">
      This is an automated notification from the Payment System.
    </div>
  </div>
</body>
</html>
          `.trim(),
        };

        // Send email notification
        console.log('[Payment Notifications] Calling sendEmail function...');
        console.log('[Payment Notifications] Email recipient:', user.email);
        console.log('[Payment Notifications] Email subject:', emailData.subject);
        
        await sendEmail(emailData);

        console.log('[Payment Notifications] ✓ Email sent successfully to:', user.email);
        result.notifiedUsers.push(user.email!);
        
      } catch (error: any) {
        console.error('[Payment Notifications] ========================================');
        console.error('[Payment Notifications] ✗ Failed to notify user:', user.email);
        console.error('[Payment Notifications] Error type:', typeof error);
        console.error('[Payment Notifications] Error name:', error?.name);
        console.error('[Payment Notifications] Error message:', error?.message);
        console.error('[Payment Notifications] Error code:', error?.code);
        console.error('[Payment Notifications] Error stack:', error?.stack);
        console.error('[Payment Notifications] Full error:', error);
        console.error('[Payment Notifications] ========================================');
        result.errors.push(`Failed to notify ${user.email}: ${error?.message || 'Unknown error'}`);
        result.success = false;
      }
    }

    console.log('[Payment Notifications] ================================================');
    console.log('[Payment Notifications] Notification process complete');
    console.log('[Payment Notifications] Successfully notified:', result.notifiedUsers.length, 'users');
    console.log('[Payment Notifications] Errors:', result.errors.length);
    if (result.notifiedUsers.length > 0) {
      console.log('[Payment Notifications] Notified users:', result.notifiedUsers.join(', '));
    }
    if (result.errors.length > 0) {
      console.log('[Payment Notifications] Error details:', result.errors.join('; '));
    }
    console.log('[Payment Notifications] Overall success:', result.success);
    console.log('[Payment Notifications] ================================================');
    
    return result;
  } catch (error: any) {
    console.error('[Payment Notifications] ================================================');
    console.error('[Payment Notifications] FATAL ERROR in notification process');
    console.error('[Payment Notifications] Payment ID:', payment.paymentId);
    console.error('[Payment Notifications] Error type:', typeof error);
    console.error('[Payment Notifications] Error name:', error?.name);
    console.error('[Payment Notifications] Error message:', error?.message);
    console.error('[Payment Notifications] Error stack:', error?.stack);
    console.error('[Payment Notifications] Full error:', error);
    console.error('[Payment Notifications] ================================================');
    result.success = false;
    result.errors.push(`Fatal error: ${error?.message || 'Unknown error'}`);
    return result;
  }
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
