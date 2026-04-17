import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-guard';
import { getUserPermissions, getUserModules } from '@/lib/permissions';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/permissions/me
 * Get current user's permissions and accessible modules
 */
export async function GET() {
  try {
    const authResult = await requireAuth();
    if (authResult instanceof NextResponse) return authResult;
    const session = authResult;
    const userId = session.user?.id;

    if (!userId) {
      return NextResponse.json({ error: 'User ID not found' }, { status: 400 });
    }

    const [permissions, userModules] = await Promise.all([
      getUserPermissions(userId),
      getUserModules(userId),
    ]);

    // Get all active modules with their features (needed for module-level permission checks)
    const allModules = await prisma.module.findMany({
      where: { isActive: true },
      include: {
        ModuleFeature: {
          where: { isActive: true },
          orderBy: { name: 'asc' },
        },
      },
      orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    });

    // Transform permissions into an easy-to-check format
    const permissionsMap: Record<string, string[]> = {};
    permissions.forEach((perm) => {
      if (!permissionsMap[perm.moduleKey]) {
        permissionsMap[perm.moduleKey] = [];
      }
      permissionsMap[perm.moduleKey].push(perm.featureKey);
    });

    return NextResponse.json({
      user: {
        id: userId,
        role: session.user?.role || 'user',
        isSystemAdmin: session.user?.role === 'system_admin',
      },
      permissions: permissionsMap,
      modules: allModules, // Return all modules with features for permission status checks
      accessibleModules: userModules, // Return only modules user can access
      rawPermissions: permissions,
    });
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('Error fetching user permissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch permissions' },
      { status: 500 }
    );
  }
}
