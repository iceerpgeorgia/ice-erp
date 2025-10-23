import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import UsersManagementTable from '@/components/figma/users-management-table';

export default async function UsersManagementPage() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/api/auth/signin');
  }

  if (session.user.role !== 'system_admin') {
    redirect('/');
  }

  return (
    <div className="container mx-auto">
      <UsersManagementTable />
    </div>
  );
}
