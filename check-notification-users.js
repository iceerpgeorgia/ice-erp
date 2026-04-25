const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkNotificationUsers() {
  const users = await prisma.user.findMany({
    where: {
      paymentNotifications: true,
    },
    select: {
      id: true,
      name: true,
      email: true,
      paymentNotifications: true,
      isAuthorized: true,
    },
    orderBy: {
      email: 'asc',
    },
  });

  console.log('\n=== Users with Payment Notifications Enabled ===\n');
  console.log(`Total: ${users.length} users\n`);
  
  if (users.length === 0) {
    console.log('❌ No users have payment notifications enabled!');
    console.log('   Users need to enable notifications in User Management.\n');
  } else {
    console.table(users.map(u => ({
      ID: u.id,
      Name: u.name || '(no name)',
      Email: u.email,
      Notifications: u.paymentNotifications ? '✓' : '✗',
      Authorized: u.isAuthorized ? '✓' : '✗',
    })));
    
    const authorizedCount = users.filter(u => u.isAuthorized).length;
    console.log(`\n📧 Emails will be sent FROM: iceerpgeorgia@gmail.com`);
    console.log(`📬 Emails will be sent TO: ${authorizedCount} user(s)\n`);
    
    if (authorizedCount < users.length) {
      console.log(`⚠️  ${users.length - authorizedCount} user(s) have notifications enabled but are NOT authorized`);
      console.log('   (they will not receive emails until isAuthorized = true)\n');
    }
  }
  
  await prisma.$disconnect();
}

checkNotificationUsers().catch(console.error);
