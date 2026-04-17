'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface AnalyticsData {
  summary: {
    totalUsers: number;
    totalModules: number;
    totalFeatures: number;
    totalUserPermissions: number;
    activeUsers: number;
    usersWithoutPermissions: number;
    averagePermissionsPerUser: number;
  };
  mostGrantedFeatures: Array<{
    featureName: string;
    featureKey: string;
    moduleName: string;
    moduleKey: string;
    grantCount: number;
  }>;
  moduleUsage: Array<{
    moduleKey: string;
    moduleName: string;
    userCount: number;
  }>;
  userDistribution: {
    none: number;
    few: number;
    moderate: number;
    many: number;
    extensive: number;
  };
  recentChanges: Array<{
    id: string;
    action: string;
    userEmail: string | null;
    createdAt: string;
    changes: any;
  }>;
  usersWithoutPermissions: Array<{
    id: string;
    name: string | null;
    email: string | null;
    role: string;
  }>;
}

export default function AnalyticsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check authorization
  useEffect(() => {
    if (status === 'loading') return;
    
    if (!session?.user) {
      router.push('/auth/signin');
      return;
    }

    // @ts-ignore
    if (session.user.role !== 'system_admin' && session.user.role !== 'admin') {
      router.push('/');
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/permissions/analytics');
      
      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const data = await response.json();
      setAnalytics(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  if (status === 'loading' || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading analytics...</div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg text-red-600">{error || 'No data available'}</div>
      </div>
    );
  }

  const distributionTotal =
    analytics.userDistribution.none +
    analytics.userDistribution.few +
    analytics.userDistribution.moderate +
    analytics.userDistribution.many +
    analytics.userDistribution.extensive;

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Permission Analytics</h1>
          <p className="text-gray-600 mt-1">Overview of permission usage and statistics</p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Total Users</div>
            <div className="text-3xl font-bold text-gray-900">{analytics.summary.totalUsers}</div>
            <div className="text-xs text-gray-500 mt-1">
              {analytics.summary.activeUsers} with permissions
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Total Permissions</div>
            <div className="text-3xl font-bold text-gray-900">
              {analytics.summary.totalUserPermissions}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              Across {analytics.summary.totalModules} modules
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Avg Permissions/User</div>
            <div className="text-3xl font-bold text-gray-900">
              {analytics.summary.averagePermissionsPerUser}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {analytics.summary.totalFeatures} total features
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="text-sm text-gray-600 mb-1">Users Without Access</div>
            <div className="text-3xl font-bold text-red-600">
              {analytics.summary.usersWithoutPermissions}
            </div>
            <div className="text-xs text-gray-500 mt-1">Need permission assignment</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Most Granted Features */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Most Granted Features
            </h2>
            <div className="space-y-3">
              {analytics.mostGrantedFeatures.slice(0, 8).map((feature, index) => (
                <div
                  key={index}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{feature.featureName}</div>
                    <div className="text-xs text-gray-500">
                      {feature.moduleName} • {feature.featureKey}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-blue-600">
                      {feature.grantCount}
                    </div>
                    <div className="text-xs text-gray-500">users</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Module Usage */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Module Usage</h2>
            <div className="space-y-3">
              {analytics.moduleUsage.map((module, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium text-gray-900">{module.moduleName}</div>
                    <div className="text-xs text-gray-500">{module.moduleKey}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold text-green-600">
                      {module.userCount}
                    </div>
                    <div className="text-xs text-gray-500">users</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* User Distribution */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">User Permission Distribution</h2>
          <div className="grid grid-cols-5 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-red-600">
                {analytics.userDistribution.none}
              </div>
              <div className="text-sm text-gray-600 mt-1">No Permissions</div>
              <div className="text-xs text-gray-500 mt-1">
                {distributionTotal > 0
                  ? Math.round((analytics.userDistribution.none / distributionTotal) * 100)
                  : 0}
                %
              </div>
            </div>
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="text-2xl font-bold text-yellow-600">
                {analytics.userDistribution.few}
              </div>
              <div className="text-sm text-gray-600 mt-1">Few (1-5)</div>
              <div className="text-xs text-gray-500 mt-1">
                {distributionTotal > 0
                  ? Math.round((analytics.userDistribution.few / distributionTotal) * 100)
                  : 0}
                %
              </div>
            </div>
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {analytics.userDistribution.moderate}
              </div>
              <div className="text-sm text-gray-600 mt-1">Moderate (6-15)</div>
              <div className="text-xs text-gray-500 mt-1">
                {distributionTotal > 0
                  ? Math.round((analytics.userDistribution.moderate / distributionTotal) * 100)
                  : 0}
                %
              </div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {analytics.userDistribution.many}
              </div>
              <div className="text-sm text-gray-600 mt-1">Many (16-30)</div>
              <div className="text-xs text-gray-500 mt-1">
                {distributionTotal > 0
                  ? Math.round((analytics.userDistribution.many / distributionTotal) * 100)
                  : 0}
                %
              </div>
            </div>
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="text-2xl font-bold text-purple-600">
                {analytics.userDistribution.extensive}
              </div>
              <div className="text-sm text-gray-600 mt-1">Extensive (31+)</div>
              <div className="text-xs text-gray-500 mt-1">
                {distributionTotal > 0
                  ? Math.round((analytics.userDistribution.extensive / distributionTotal) * 100)
                  : 0}
                %
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Recent Changes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Recent Changes</h2>
            <div className="space-y-2">
              {analytics.recentChanges.slice(0, 10).map((change) => (
                <div
                  key={change.id}
                  className="flex items-center gap-3 p-2 text-sm border-b border-gray-100 last:border-0"
                >
                  <span
                    className={`px-2 py-1 text-xs rounded ${
                      change.action === 'create'
                        ? 'bg-green-100 text-green-700'
                        : change.action === 'delete'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    {change.action}
                  </span>
                  <span className="text-gray-600 flex-1 truncate">
                    {change.userEmail || 'Unknown user'}
                  </span>
                  <span className="text-xs text-gray-500">
                    {new Date(change.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Users Without Permissions */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              Users Without Permissions
            </h2>
            {analytics.usersWithoutPermissions.length > 0 ? (
              <div className="space-y-2">
                {analytics.usersWithoutPermissions.slice(0, 10).map((user) => (
                  <div
                    key={user.id}
                    className="flex justify-between items-center p-3 bg-red-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900">{user.name || 'No Name'}</div>
                      <div className="text-xs text-gray-600">{user.email}</div>
                    </div>
                    <span className="text-xs px-2 py-1 bg-gray-200 text-gray-700 rounded">
                      {user.role}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">
                All users have been assigned permissions 🎉
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
