import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import UsersManagementTable from '@/components/figma/users-management-table';

export default async function UsersManagementPage() {
  const session = await getServerSession(authOptions);

  console.log('[admin/users] Session check:', {
    hasSession: !!session,
    email: session?.user?.email,
    role: session?.user?.role,
    isAuthorized: session?.user?.isAuthorized,
  });

  if (!session) {
    console.log('[admin/users] No session, redirecting to signin');
    redirect('/api/auth/signin');
  }

  if (session.user.role !== 'system_admin') {
    console.log('[admin/users] Not system_admin, redirecting to home. Role:', session.user.role);
    redirect('/');
  }

  return (
    <div className="container mx-auto">
      <UsersManagementTable />
    </div>
  );
}
