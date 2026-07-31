import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import { PrismaClient } from '@prisma/client';
import TroubleshootingAnalyticsView from '@/components/troubleshooting/analytics-view';

const prisma = new PrismaClient();

async function getTroubleshootingData() {
  const prompts = await prisma.troubleshooting_prompts.findMany({
    orderBy: { created_at: 'desc' },
    take: 500,
  });

  return {
    total: prompts.length,
    unfollowed: prompts.filter(p => !p.is_followed_up).length,
    confirmed: prompts.filter(p => p.confirmed_by_user).length,
    prompts,
  };
}

export default async function TroubleshootingAnalyticsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user || session.user.role !== 'system_admin') {
    redirect('/');
  }

  const data = await getTroubleshootingData();

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Troubleshooting Prompts Analytics
        </h1>
        <p className="text-gray-600">
          Monitor user issues and track support team follow-ups
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">
            Total Prompts
          </div>
          <div className="text-3xl font-bold text-gray-900">{data.total}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">
            Unfollowed Up
          </div>
          <div className="text-3xl font-bold text-red-600">{data.unfollowed}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="text-sm font-medium text-gray-600 mb-2">
            Confirmed by Users
          </div>
          <div className="text-3xl font-bold text-green-600">{data.confirmed}</div>
        </div>
      </div>

      {/* Table */}
      <TroubleshootingAnalyticsView initialPrompts={data.prompts} />
    </div>
  );
}
