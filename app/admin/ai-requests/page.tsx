import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { REQUEST_ADMIN_ROLES } from '@/lib/ai-chat/requests';
import AiRequestsAdmin from '@/components/ai-requests-admin';

// Requests users sent from the AI chat. Admins and system admins only.
export default async function AiRequestsPage() {
  const session = await getServerSession(authOptions);
  if (!session) redirect('/api/auth/signin');
  if (!REQUEST_ADMIN_ROLES.includes(String((session.user as any).role))) redirect('/');
  return (
    <div className="container mx-auto py-8">
      <AiRequestsAdmin />
    </div>
  );
}
