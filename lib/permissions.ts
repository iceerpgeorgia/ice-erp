/**
 * Permission checking utilities for module-based authorization
 * Supports both user-specific permissions and role-based permissions
 * Enhanced with caching layer for improved performance
 */

import { prisma } from '@/lib/prisma';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  permissionCache,
  getPermissionCacheKey,
  getUserPermissionsCacheKey,
  getUserModulesCacheKey,
} from '@/lib/permission-cache';

export interface PermissionCheck {
  moduleKey: string;
  featureKey: string;
}

/**
 * Check if a user has a specific permission
 * Checks both user-specific permissions and role-based permissions
 * Uses caching layer for improved performance
 * 
 * @param userId - User ID to check
 * @param moduleKey - Module key (e.g., "bank_transactions")
 * @param featureKey - Feature key (e.g., "view", "create", "edit", "delete")
 * @returns true if user has permission, false otherwise
 */
export async function hasPermission(
  userId: string,
  moduleKey: string,
  featureKey: string
): Promise<boolean> {
  try {
    // Check cache first
    const cacheKey = getPermissionCacheKey(userId, moduleKey, featureKey);
    const cached = permissionCache.get<boolean>(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    // Get user role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isAuthorized: true },
    });

    if (!user || !user.isAuthorized) {
      permissionCache.set(cacheKey, false, 60000); // Cache for 1 minute
      return false;
    }

    // system_admin has all permissions
    if (user.role === 'system_admin') {
      permissionCache.set(cacheKey, true);
      return true;
    }

    // Find the module and feature
    const moduleRecord = await prisma.module.findUnique({
      where: { key: moduleKey, isActive: true },
    });

    if (!moduleRecord) {
      permissionCache.set(cacheKey, false, 60000);
      return false;
    }

    const feature = await prisma.moduleFeature.findFirst({
      where: {
        moduleId: moduleRecord.id,
        key: featureKey,
        isActive: true,
      },
    });

    if (!feature) {
      permissionCache.set(cacheKey, false, 60000);
      return false;
    }

    // Check user-specific permission
    const userPermission = await prisma.userPermission.findFirst({
      where: {
        userId,
        moduleFeatureId: feature.id,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
    });

    if (userPermission) {
      permissionCache.set(cacheKey, true);
      return true;
    }

    // Check role-based permission
    const rolePermission = await prisma.rolePermission.findFirst({
      where: {
        role: user.role,
        moduleFeatureId: feature.id,
        isActive: true,
      },
    });

    const hasAccess = !!rolePermission;
    permissionCache.set(cacheKey, hasAccess);
    return hasAccess;
  } catch (error) {
    console.error('Error checking permission:', error);
    return false;
  }
}

/**
 * Check multiple permissions at once
 * Returns an object mapping each permission check to its result
 */
export async function hasPermissions(
  userId: string,
  checks: PermissionCheck[]
): Promise<Record<string, boolean>> {
  const results: Record<string, boolean> = {};

  await Promise.all(
    checks.map(async ({ moduleKey, featureKey }) => {
      const key = `${moduleKey}.${featureKey}`;
      results[key] = await hasPermission(userId, moduleKey, featureKey);
    })
  );

  return results;
}

/**
 * Get all permissions for a user
 * Returns both user-specific and role-based permissions
 * Uses caching for improved performance
 */
export async function getUserPermissions(userId: string) {
  try {
    // Check cache first
    const cacheKey = getUserPermissionsCacheKey(userId);
    const cached = permissionCache.get<any[]>(cacheKey);
    
    if (cached !== null) {
      return cached;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isAuthorized: true },
    });

    if (!user || !user.isAuthorized) {
      permissionCache.set(cacheKey, [], 60000);
      return [];
    }

    // system_admin has all permissions
    if (user.role === 'system_admin') {
      const allFeatures = await prisma.moduleFeature.findMany({
        where: {
          isActive: true,
          module: {
            isActive: true,
          },
        },
        include: {
          module: true,
        },
      });

      const permissions = allFeatures
        .filter((f) => f.module)
        .map((f) => ({
          moduleKey: f.module.key,
          moduleName: f.module.name,
          featureKey: f.key,
          featureName: f.name,
          source: 'system_admin' as const,
        }));
      
      permissionCache.set(cacheKey, permissions);
      return permissions;
    }

    // Get user-specific permissions
    const userPermissions = await prisma.userPermission.findMany({
      where: {
        userId,
        isActive: true,
        OR: [
          { expiresAt: null },
          { expiresAt: { gt: new Date() } },
        ],
      },
      include: {
        moduleFeature: {
          include: {
            module: true,
          },
        },
      },
    });

    // Get role-based permissions
    const rolePermissions = await prisma.rolePermission.findMany({
      where: {
        role: user.role,
        isActive: true,
      },
      include: {
        moduleFeature: {
          include: {
            module: true,
          },
        },
      },
    });

    const permissions = [
      ...userPermissions.map((p) => ({
        moduleKey: p.moduleFeature.module.key,
        moduleName: p.moduleFeature.module.name,
        featureKey: p.moduleFeature.key,
        featureName: p.moduleFeature.name,
        source: 'user' as const,
        expiresAt: p.expiresAt,
      })),
      ...rolePermissions.map((p) => ({
        moduleKey: p.moduleFeature.module.key,
        moduleName: p.moduleFeature.module.name,
        featureKey: p.moduleFeature.key,
        featureName: p.moduleFeature.name,
        source: 'role' as const,
      })),
    ];

    // Remove duplicates (user permissions override role permissions)
    const uniquePermissions = permissions.reduce((acc, perm) => {
      const key = `${perm.moduleKey}.${perm.featureKey}`;
      if (!acc[key] || perm.source === 'user') {
        acc[key] = perm;
      }
      return acc;
    }, {} as Record<string, any>);

    const result = Object.values(uniquePermissions);
    permissionCache.set(cacheKey, result);
    return result;
  } catch (error) {
    console.error('Error getting user permissions:', error);
    return [];
  }
}

/**
 * Middleware to check permission on API routes
 * Usage: await requirePermission('bank_transactions', 'view');
 */
export async function requirePermission(
  moduleKey: string,
  featureKey: string
): Promise<void> {
  const session = await getServerSession(authOptions);

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const allowed = await hasPermission(session.user.id, moduleKey, featureKey);

  if (!allowed) {
    throw new Error('Forbidden');
  }
}

/**
 * Get modules accessible by a user (have at least one feature permission)
 */
export async function getUserModules(userId: string) {
  const permissions = await getUserPermissions(userId);
  
  const moduleKeys = [...new Set(permissions.map((p) => p.moduleKey))];
  
  const modules = await prisma.module.findMany({
    where: {
      key: { in: moduleKeys },
      isActive: true,
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });

  return modules;
}

/**
 * Check if a user has all permissions for a module
 * Useful for determining if a module is "fully granted" vs "partially granted"
 * 
 * @param userId - User ID to check
 * @param moduleKey - Module key to check
 * @returns { hasAll: boolean, granted: number, total: number, missing: string[] }
 */
export async function hasModulePermissions(userId: string, moduleKey: string) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, isAuthorized: true },
    });

    if (!user || !user.isAuthorized) {
      return { hasAll: false, granted: 0, total: 0, missing: [] };
    }

    // system_admin has all permissions
    if (user.role === 'system_admin') {
      const moduleRecord = await prisma.module.findUnique({
        where: { key: moduleKey },
        include: {
          ModuleFeature: {
            where: { isActive: true },
          },
        },
      });

      if (!moduleRecord) {
        return { hasAll: false, granted: 0, total: 0, missing: [] };
      }

      return {
        hasAll: true,
        granted: moduleRecord.ModuleFeature.length,
        total: moduleRecord.ModuleFeature.length,
        missing: [],
      };
    }

    // Get all features for this module
    const moduleRecord = await prisma.module.findUnique({
      where: { key: moduleKey },
      include: {
        ModuleFeature: {
          where: { isActive: true },
        },
      },
    });

    if (!moduleRecord || !moduleRecord.isActive) {
      return { hasAll: false, granted: 0, total: 0, missing: [] };
    }

    const allFeatures = moduleRecord.ModuleFeature;
    const totalFeatures = allFeatures.length;

    if (totalFeatures === 0) {
      return { hasAll: true, granted: 0, total: 0, missing: [] };
    }

    // Get user's permissions for this module
    const userPermissions = await getUserPermissions(userId);
    const userFeatureKeys = new Set(
      userPermissions
        .filter((p) => p.moduleKey === moduleKey)
        .map((p) => p.featureKey)
    );

    const grantedCount = userFeatureKeys.size;
    const missingFeatures = allFeatures
      .filter((f) => !userFeatureKeys.has(f.key))
      .map((f) => f.key);

    return {
      hasAll: grantedCount === totalFeatures,
      granted: grantedCount,
      total: totalFeatures,
      missing: missingFeatures,
    };
  } catch (error) {
    console.error('Error checking module permissions:', error);
    return { hasAll: false, granted: 0, total: 0, missing: [] };
  }
}
