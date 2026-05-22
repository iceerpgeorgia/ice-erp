const fs = require('fs');
const filePath = 'app/api/payments/route.ts';
let s = fs.readFileSync(filePath, 'utf8');
const isCRLF = s.includes('\r\n');

const oldLF = `      // Count attachments for this payment
      prisma.attachments.count({
        where: {
          links: {
            some: {
              owner_table: 'payments',
              owner_uuid: paymentIdForNotification,
            },
          },
          is_active: true,
        },
      }).then(async () => {
        const notificationResult = await sendPaymentNotifications({
          paymentId: paymentIdForNotification,
          label: (payment as any).label,
        });

        if (!notificationResult.success) {
          console.error('[Payment Notifications] Notification completed with errors:', notificationResult.errors);
        }
      }).catch(err => {
        console.error('[Payment Notifications] Error sending notifications:', err);
      });`;

const newLF = `      // Send notifications asynchronously
      sendPaymentNotifications({
        paymentId: paymentIdForNotification,
        label: (payment as any).label,
      }).then(notificationResult => {
        if (!notificationResult.success) {
          console.error('[Payment Notifications] Notification completed with errors:', notificationResult.errors);
        }
      }).catch(err => {
        console.error('[Payment Notifications] Error sending notifications:', err);
      });`;

const old = isCRLF ? oldLF.replace(/\n/g, '\r\n') : oldLF;
const nw  = isCRLF ? newLF.replace(/\n/g, '\r\n') : newLF;

if (!s.includes(old)) { console.error('MISS: pattern not found'); process.exit(1); }
s = s.replace(old, nw);
fs.writeFileSync(filePath, s, 'utf8');
console.log('OK: removed broken attachments.count() wrapper');
