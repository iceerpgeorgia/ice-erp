'use client';

import { useEffect, useState, useCallback } from 'react';

export interface Permission {
  moduleKey: string;
  moduleName: string;
  featureKey: string;
  featureName: string;
  source: 'user' | 'role' | 'system_admin';
  expiresAt?: Date | null;
}

export interface Module {
  id: bigint;
  uuid: string;
  name: string;
  key: string;
  description: string | null;
  icon: string | null;
  route: string | null;
  displayOrder: number;
  isActive: boolean;
  ModuleFeature?: ModuleFeature[];
}

export interface ModuleFeature {
  id: bigint;
  uuid: string;
  name: string;
  key: string;
  description: string | null;
  featureType: string;
  isActive: boolean;
}

export interface ModulePermissionStatus {
  hasAll: boolean;
  granted: number;
  total: number;
  missing: string[];
  isPartial: boolean;
}

export interface UserPermissionData {
  user: {
    id: string;
    role: string;
    isSystemAdmin: boolean;
  };
  permissions: Record<string, string[]>; // moduleKey -> featureKeys[]
  modules: Module[];
  rawPermissions: Permission[];
}

interface UsePermissionsResult {
  permissions: Record<string, string[]>;
  modules: Module[];
  rawPermissions: Permission[];
  isSystemAdmin: boolean;
  hasPermission: (moduleKey: string, featureKey: string) => boolean;
  hasAnyPermission: (checks: Array<{ moduleKey: string; featureKey: string }>) => boolean;
  hasAllPermissions: (checks: Array<{ moduleKey: string; featureKey: string }>) => boolean;
  canAccessModule: (moduleKey: string) => boolean;
  hasAllModulePermissions: (moduleKey: string) => boolean;
  getModulePermissionStatus: (moduleKey: string) => ModulePermissionStatus;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * React hook for checking user permissions on the client side
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { hasPermission, isLoading } = usePermissions();
 *   
 *   if (isLoading) return <Spinner />;
 *   
 *   return (
 *     <>
 *       {hasPermission('bank_transactions', 'create') && (
 *         <CreateButton />
 *       )}
 *     </>
 *   );
 * }
 * ```
 */
export function usePermissions(): UsePermissionsResult {
  const [data, setData] = useState<UserPermissionData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch('/api/permissions/me');
      
      if (!response.ok) {
        throw new Error('Failed to fetch permissions');
      }

      const permissionData = await response.json();
      setData(permissionData);
    } catch (err) {
      console.error('Error fetching permissions:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPermissions();
  }, [fetchPermissions]);

  /**
   * Check if user has a specific permission
   */
  const hasPermission = useCallback(
    (moduleKey: string, featureKey: string): boolean => {
      if (!data) return false;
      
      // System admin has all permissions
      if (data.user.isSystemAdmin) return true;

      // Check permissions map
      return data.permissions[moduleKey]?.includes(featureKey) ?? false;
    },
    [data]
  );

  /**
   * Check if user has ANY of the specified permissions
   */
  const hasAnyPermission = useCallback(
    (checks: Array<{ moduleKey: string; featureKey: string }>): boolean => {
      return checks.some(({ moduleKey, featureKey }) =>
        hasPermission(moduleKey, featureKey)
      );
    },
    [hasPermission]
  );

  /**
   * Check if user has ALL of the specified permissions
   */
  const hasAllPermissions = useCallback(
    (checks: Array<{ moduleKey: string; featureKey: string }>): boolean => {
      return checks.every(({ moduleKey, featureKey }) =>
        hasPermission(moduleKey, featureKey)
      );
    },
    [hasPermission]
  );

  /**
   * Check if user can access a module (has at least one feature permission)
   */
  const canAccessModule = useCallback(
    (moduleKey: string): boolean => {
      if (!data) return false;
      
      // System admin can access all modules
      if (data.user.isSystemAdmin) return true;

      // Check if user has any permissions for this module
      return data.permissions[moduleKey]?.length > 0 ?? false;
    },
    [data]
  );

  /**
   * Check if user has ALL permissions for a module
   */
  const hasAllModulePermissions = useCallback(
    (moduleKey: string): boolean => {
      if (!data) return false;
      
      // System admin has all permissions
      if (data.user.isSystemAdmin) return true;

      // Find the module in the modules list
      const module = data.modules.find((m) => m.key === moduleKey);
      if (!module || !module.ModuleFeature) return false;

      const activeFeatures = module.ModuleFeature.filter((f) => f.isActive);
      if (activeFeatures.length === 0) return true; // No features to check

      const userFeatures = data.permissions[moduleKey] ?? [];
      
      // Check if user has all active features
      return activeFeatures.every((feature) =>
        userFeatures.includes(feature.key)
      );
    },
    [data]
  );

  /**
   * Get detailed permission status for a module
   * Returns granted count, total count, missing features, etc.
   */
  const getModulePermissionStatus = useCallback(
    (moduleKey: string): ModulePermissionStatus => {
      const defaultStatus: ModulePermissionStatus = {
        hasAll: false,
        granted: 0,
        total: 0,
        missing: [],
        isPartial: false,
      };

      if (!data) return defaultStatus;
      
      // System admin has all permissions
      if (data.user.isSystemAdmin) {
        const module = data.modules.find((m) => m.key === moduleKey);
        if (!module || !module.ModuleFeature) return defaultStatus;
        
        const activeFeatures = module.ModuleFeature.filter((f) => f.isActive);
        return {
          hasAll: true,
          granted: activeFeatures.length,
          total: activeFeatures.length,
          missing: [],
          isPartial: false,
        };
      }

      // Find the module
      const module = data.modules.find((m) => m.key === moduleKey);
      if (!module || !module.ModuleFeature) return defaultStatus;

      const activeFeatures = module.ModuleFeature.filter((f) => f.isActive);
      const totalFeatures = activeFeatures.length;

      if (totalFeatures === 0) {
        return {
          hasAll: true,
          granted: 0,
          total: 0,
          missing: [],
          isPartial: false,
        };
      }

      const userFeatures = new Set(data.permissions[moduleKey] ?? []);
      const grantedCount = activeFeatures.filter((f) =>
        userFeatures.has(f.key)
      ).length;

      const missingFeatures = activeFeatures
        .filter((f) => !userFeatures.has(f.key))
        .map((f) => f.key);

      return {
        hasAll: grantedCount === totalFeatures,
        granted: grantedCount,
        total: totalFeatures,
        missing: missingFeatures,
        isPartial: grantedCount > 0 && grantedCount < totalFeatures,
      };
    },
    [data]
  );

  return {
    permissions: data?.permissions ?? {},
    modules: data?.modules ?? [],
    rawPermissions: data?.rawPermissions ?? [],
    isSystemAdmin: data?.user.isSystemAdmin ?? false,
    hasPermission,
    hasAnyPermission,
    hasAllPermissions,
    canAccessModule,
    hasAllModulePermissions,
    getModulePermissionStatus,
    isLoading,
    error,
    refetch: fetchPermissions,
  };
}

/**
 * Higher-order component to wrap components that require specific permissions
 * 
 * @example
 * ```tsx
 * const ProtectedButton = withPermission(
 *   Button,
 *   'bank_transactions',
 *   'create'
 * );
 * ```
 */
export function withPermission<P extends object>(
  Component: React.ComponentType<P>,
  moduleKey: string,
  featureKey: string,
  fallback?: React.ReactNode
) {
  return function PermissionGuard(props: P) {
    const { hasPermission, isLoading } = usePermissions();

    if (isLoading) {
      return fallback ?? null;
    }

    if (!hasPermission(moduleKey, featureKey)) {
      return fallback ?? null;
    }

    return <Component {...props} />;
  };
}

/**
 * Component to conditionally render children based on permissions
 * 
 * @example
 * ```tsx
 * <PermissionGate moduleKey="bank_transactions" featureKey="create">
 *   <CreateButton />
 * </PermissionGate>
 * ```
 */
export function PermissionGate({
  moduleKey,
  featureKey,
  anyOf,
  allOf,
  fallback,
  children,
}: {
  moduleKey?: string;
  featureKey?: string;
  anyOf?: Array<{ moduleKey: string; featureKey: string }>;
  allOf?: Array<{ moduleKey: string; featureKey: string }>;
  fallback?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { hasPermission, hasAnyPermission, hasAllPermissions, isLoading } =
    usePermissions();

  if (isLoading) {
    return fallback ?? null;
  }

  let allowed = false;

  if (moduleKey && featureKey) {
    allowed = hasPermission(moduleKey, featureKey);
  } else if (anyOf) {
    allowed = hasAnyPermission(anyOf);
  } else if (allOf) {
    allowed = hasAllPermissions(allOf);
  }

  if (!allowed) {
    return fallback ?? null;
  }

  return <>{children}</>;
}
