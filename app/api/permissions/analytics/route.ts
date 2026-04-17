import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/permissions/analytics
 * Get permission analytics and statistics
 */
export async function GET() {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    // Get total counts
    const [
      totalUsers,
      totalModules,
      totalFeatures,
      totalUserPermissions,
      activeUsers,
    ] = await Promise.all([
      prisma.user.count({ where: { isAuthorized: true } }),
      prisma.module.count({ where: { isActive: true } }),
      prisma.moduleFeature.count({ where: { isActive: true } }),
      prisma.userPermission.count({ where: { isActive: true } }),
      prisma.user.count({
        where: {
          isAuthorized: true,
          UserPermission: {
            some: { isActive: true },
          },
        },
      }),
    ]);

    // Get most granted features
    const featureStats = await prisma.userPermission.groupBy({
      by: ['moduleFeatureId'],
      where: { isActive: true },
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
      take: 10,
    });

    const featureIds = featureStats.map((s) => s.moduleFeatureId);
    const features = await prisma.moduleFeature.findMany({
      where: { id: { in: featureIds } },
      include: { module: true },
    });

    const mostGrantedFeatures = featureStats.map((stat) => {
      const feature = features.find((f) => f.id === stat.moduleFeatureId);
      return {
        featureName: feature?.name || 'Unknown',
        featureKey: feature?.key || 'unknown',
        moduleName: feature?.module.name || 'Unknown',
        moduleKey: feature?.module.key || 'unknown',
        grantCount: stat._count.id,
      };
    });

    // Get module usage stats
    const moduleUsage = await prisma.$queryRaw<
      Array<{ module_key: string; module_name: string; user_count: bigint }>
    >`
      SELECT 
        m.key as module_key,
        m.name as module_name,
        COUNT(DISTINCT up.user_id) as user_count
      FROM "Module" m
      LEFT JOIN "ModuleFeature" mf ON mf.module_id = m.id
      LEFT JOIN "UserPermission" up ON up.module_feature_id = mf.id AND up.is_active = true
      WHERE m.is_active = true
      GROUP BY m.id, m.key, m.name
      ORDER BY user_count DESC
    `;

    const moduleUsageStats = moduleUsage.map((m) => ({
      moduleKey: m.module_key,
      moduleName: m.module_name,
      userCount: Number(m.user_count),
    }));

    // Get user permission distribution
    const userDistribution = await prisma.$queryRaw<
      Array<{ permission_count: bigint; user_count: bigint }>
    >`
      SELECT 
        COUNT(up.id) as permission_count,
        COUNT(u.id) as user_count
      FROM "User" u
      LEFT JOIN "UserPermission" up ON up.user_id = u.id AND up.is_active = true
      WHERE u.is_authorized = true
      GROUP BY u.id
      ORDER BY permission_count DESC
    `;

    const distributionBuckets = {
      none: 0,
      few: 0, // 1-5
      moderate: 0, // 6-15
      many: 0, // 16-30
      extensive: 0, // 31+
    };

    userDistribution.forEach((dist) => {
      const count = Number(dist.permission_count);
      if (count === 0) distributionBuckets.none++;
      else if (count <= 5) distributionBuckets.few++;
      else if (count <= 15) distributionBuckets.moderate++;
      else if (count <= 30) distributionBuckets.many++;
      else distributionBuckets.extensive++;
    });

    // Get recent permission changes from audit log
    const recentChanges = await prisma.auditLog.findMany({
      where: {
        table: 'UserPermission',
        action: { in: ['create', 'delete', 'update'] },
      },
      orderBy: { created_at: 'desc' },
      take: 20,
      select: {
        id: true,
        action: true,
        user_email: true,
        created_at: true,
        changes: true,
      },
    });

    // Get users without any permissions
    const usersWithoutPermissions = await prisma.user.findMany({
      where: {
        isAuthorized: true,
        UserPermission: {
          none: {
            isActive: true,
          },
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
      take: 20,
    });

    return NextResponse.json({
      summary: {
        totalUsers,
        totalModules,
        totalFeatures,
        totalUserPermissions,
        activeUsers,
        usersWithoutPermissions: usersWithoutPermissions.length,
        averagePermissionsPerUser:
          activeUsers > 0 ? Math.round((totalUserPermissions / activeUsers) * 10) / 10 : 0,
      },
      mostGrantedFeatures,
      moduleUsage: moduleUsageStats,
      userDistribution: distributionBuckets,
      recentChanges,
      usersWithoutPermissions,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error.message === 'Forbidden') {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('Error fetching permission analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permission analytics' },
      { status: 500 }
    );
  }
}
