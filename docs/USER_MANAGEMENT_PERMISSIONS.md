# User Management & Permissions System

## Overview

This document describes the comprehensive modular permission system that allows administrators to manage users and grant granular access to specific modules and features.

## Architecture

### Database Schema

The permission system consists of four main tables:

####  **Module**
Represents high-level application sections (e.g., "Bank Transactions", "Payments", "Reports").

| Field | Type | Description |
|-------|------|-------------|
| `id` | BigInt | Primary key |
| `uuid` | UUID | Unique identifier |
| `name` | String | Display name |
| `key` | String | Unique module key (e.g., "bank_transactions") |
| `description` | Text | Module description |
| `icon` | String | Icon identifier |
| `route` | String | Navigation route |
| `display_order` | Integer | Sort order |
| `is_active` | Boolean | Active status |

#### **ModuleFeature**
Represents specific actions within modules (e.g., "view", "create", "edit", "delete").

| Field | Type | Description |
|-------|------|-------------|
| `id` | BigInt | Primary key |
| `uuid` | UUID | Unique identifier |
| `module_id` | BigInt | Foreign key to Module |
| `module_uuid` | UUID | Module UUID reference |
| `name` | String | Display name |
| `key` | String | Unique feature key within module |
| `description` | Text | Feature description |
| `feature_type` | String | Type of feature (default: "action") |
| `is_active` | Boolean | Active status |

#### **UserPermission**
Grants specific feature access to individual users.

| Field | Type | Description |
|-------|------|-------------|
| `id` | BigInt | Primary key |
| `uuid` | UUID | Unique identifier |
| `user_id` | String | Foreign key to User |
| `module_feature_id` | BigInt | Foreign key to ModuleFeature |
| `granted_by` | String | User who granted permission |
| `granted_at` | DateTime | When permission was granted |
| `expires_at` | DateTime | Optional expiration date |
| `is_active` | Boolean | Active status |

#### **RolePermission**
Defines permissions for user roles (e.g., "admin", "user").

| Field | Type | Description |
|-------|------|-------------|
| `id` | BigInt | Primary key |
| `uuid` | UUID | Unique identifier |
| `role` | String | Role name |
| `module_feature_id` | BigInt | Foreign key to ModuleFeature |
| `is_active` | Boolean | Active status |

### Permission Hierarchy

1. **System Admin** (`system_admin` role) - Has all permissions automatically
2. **User-Specific Permissions** - Directly assigned to users (highest priority)
3. **Role-Based Permissions** - Assigned to user roles
4. **No Permission** - Access denied

## API Endpoints

### Modules Management

#### `GET /api/modules`
List all modules with their features.

**Query Parameters:**
- `activeOnly` (optional): Only return active modules

**Response:**
```json
[
  {
    "id": 1,
    "uuid": "...",
    "name": "Bank Transactions",
    "key": "bank_transactions",
    "description": "Manage bank statements and transactions",
    "icon": "bank",
    "route": "/bank-transactions",
    "displayOrder": 2,
    "isActive": true,
    "ModuleFeature": [
      {
        "id": 7,
        "uuid": "...",
        "name": "View Transactions",
        "key": "view",
        "description": "View bank transactions"
      }
    ]
  }
]
```

#### `POST /api/modules`
Create a new module.

**Request Body:**
```json
{
  "name": "New Module",
  "key": "new_module",
  "description": "Module description",
  "icon": "icon-name",
  "route": "/new-module",
  "displayOrder": 10,
  "isActive": true
}
```

#### `PATCH /api/modules?uuid=xxx`
Update an existing module.

#### `DELETE /api/modules?uuid=xxx`
Delete a module (cascade deletes all features and permissions).

### Module Features Management

#### `GET /api/module-features?moduleUuid=xxx`
List features for a specific module.

**Query Parameters:**
- `moduleUuid` (optional): Filter by module
- `activeOnly` (optional): Only return active features

#### `POST /api/module-features`
Create a new feature for a module.

**Request Body:**
```json
{
  "moduleUuid": "module-uuid-here",
  "name": "Export Data",
  "key": "export",
  "description": "Export module data",
  "featureType": "action",
  "isActive": true
}
```

#### `PATCH /api/module-features?uuid=xxx`
Update a feature.

#### `DELETE /api/module-features?uuid=xxx`
Delete a feature.

### User Permissions Management

#### `GET /api/permissions/users?userId=xxx`
Get permissions for a specific user (or all users).

**Response:**
```json
[
  {
    "id": 1,
    "uuid": "...",
    "userId": "user-id",
    "moduleFeature": {
      "id": 7,
      "name": "View Transactions",
      "key": "view",
      "module": {
        "id": 1,
        "name": "Bank Transactions",
        "key": "bank_transactions"
      }
    },
    "grantedBy": "admin-id",
    "grantedAt": "2026-04-17T...",
    "expiresAt": null,
    "isActive": true
  }
]
```

#### `POST /api/permissions/users`
Grant a permission to a user.

**Request Body:**
```json
{
  "userId": "user-id",
  "moduleFeatureUuid": "feature-uuid",
  "expiresAt": "2027-01-01T00:00:00Z" // optional
}
```

#### `DELETE /api/permissions/users?uuid=xxx`
Revoke a permission.

#### `PATCH /api/permissions/users`
Bulk update user permissions (replaces all).

**Request Body:**
```json
{
  "userId": "user-id",
  "permissions": ["feature-uuid-1", "feature-uuid-2", ...]
}
```

### Module-Level Permissions (Hierarchical Grants)

Grant or revoke ALL features of a module at once, instead of assigning features individually.

#### `POST /api/permissions/modules`
Grant all features of a module to a user.

**Request Body:**
```json
{
  "userId": "user-id",
  "moduleUuid": "module-uuid",
  "expiresAt": "2027-01-01T00:00:00Z" // optional
}
```

**Response:**
```json
{
  "module": {
    "uuid": "...",
    "name": "Bank Transactions",
    "key": "bank_transactions"
  },
  "granted": [
    {
      "uuid": "perm-uuid-1",
      "featureKey": "view",
      "featureName": "View Transactions"
    },
    {
      "uuid": "perm-uuid-2",
      "featureKey": "create",
      "featureName": "Create Transaction"
    }
  ],
  "skipped": [
    {
      "featureKey": "edit",
      "featureName": "Edit Transaction",
      "reason": "already_exists"
    }
  ],
  "summary": {
    "total": 6,
    "granted": 5,
    "skipped": 1
  }
}
```

**Features:**
- Grants all active features of the module
- Skips features that are already granted
- Returns detailed summary of granted/skipped features
- Automatically invalidates cache

#### `DELETE /api/permissions/modules?userId=xxx&moduleUuid=xxx`
Revoke all features of a module from a user.

**Response:**
```json
{
  "module": {
    "uuid": "...",
    "name": "Bank Transactions",
    "key": "bank_transactions"
  },
  "revoked": 5
}
```

## Authorization Utilities

### Server-Side (API Routes)

```typescript
import { requirePermission } from '@/lib/permissions';

// Single permission check (throws if denied)
await requirePermission('bank_transactions', 'view');

// Check permission and get boolean
import { hasPermission } from '@/lib/permissions';
const canView = await hasPermission(userId, 'bank_transactions', 'view');

// Get all user permissions
import { getUserPermissions } from '@/lib/permissions';
const permissions = await getUserPermissions(userId);

// Get user's accessible modules
import { getUserModules } from '@/lib/permissions';
const modules = await getUserModules(userId);

// Check if user has ALL permissions for a module
import { hasModulePermissions } from '@/lib/permissions';
const status = await hasModulePermissions(userId, 'bank_transactions');
console.log(status);
// {
//   hasAll: false,
//   granted: 3,
//   total: 6,
//   missing: ['edit', 'delete', 'export']
// }
```

### Client-Side (React Components)

```typescript
import { usePermissions } from '@/hooks/usePermissions';

function MyComponent() {
  const { 
    hasPermission, 
    hasAnyPermission, 
    hasAllPermissions, 
    canAccessModule,
    hasAllModulePermissions,
    getModulePermissionStatus,
    permissions, 
    isLoading 
  } = usePermissions();
  
  if (isLoading) {
    return <div>Loading permissions...</div>;
  }
  
  // Single permission check
  if (hasPermission('bank_transactions', 'create')) {
    return <CreateButton />;
  }
  
  // Check if user has ALL permissions for a module
  if (hasAllModulePermissions('bank_transactions')) {
    return <FullAccessBadge />;
  }
  
  // Get detailed module permission status
  const status = getModulePermissionStatus('bank_transactions');
  console.log(status);
  // {
  //   hasAll: false,
  //   granted: 3,
  //   total: 6,
  //   missing: ['edit', 'delete', 'export'],
  //   isPartial: true
  // }
  
  return null;
}

// Using PermissionGate component
import { PermissionGate } from '@/hooks/usePermissions';

function MyFeature() {
  return (
    <PermissionGate moduleKey="bank_transactions" featureKey="create">
      <CreateButton />
    </PermissionGate>
  );
}

// Check multiple permissions (anyOf)
<PermissionGate 
  anyOf={[
    { moduleKey: 'bank_transactions', featureKey: 'create' },
    { moduleKey: 'bank_transactions', featureKey: 'edit' }
  ]}
>
  <EditFeature />
</PermissionGate>

// Using Higher-Order Component
import { withPermission } from '@/hooks/usePermissions';

const SecureComponent = withPermission(
  MyComponent,
  'bank_transactions',
  'view'
);
```

## Performance Optimization

### Permission Caching

The system implements intelligent in-memory caching to minimize database queries:

#### Cache Configuration

```typescript
// lib/permission-cache.ts
const DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes
```

#### How It Works

1. **Cache Check**: Permission checks (e.g., `hasPermission()`) first query the cache
2. **Cache Miss**: If not cached, query database and store result with TTL
3. **Cache Invalidation**: Automatically cleared when permissions/modules/features change
4. **Automatic Cleanup**: Expired entries removed every 10 minutes

#### Cache Invalidation Strategies

Permissions are automatically invalidated when:

- **User permissions change**: `POST/PATCH/DELETE /api/permissions/users` → Clear user's cache
- **Module modified**: `PATCH/DELETE /api/modules` → Clear all permissions for that module
- **Feature modified**: `POST/PATCH/DELETE /api/module-features` → Clear module cache

#### Cache Statistics

Monitor cache performance:

```typescript
import { permissionCache } from '@/lib/permission-cache';

const stats = permissionCache.getStats();
console.log(stats);
// { size: 42, keys: ['perm:user123:bank_transactions:view', ...] }
```

#### Manual Cache Management

```typescript
import { permissionCache } from '@/lib/permission-cache';

// Clear all permissions for a user
permissionCache.clearUser('user-id');

// Clear all permissions for a module
permissionCache.clearModule('bank_transactions');

// Clear all cache
// (Not recommended - happens automatically during cleanup)
```

### Client-Side Hook

The `usePermissions` hook fetches user permissions from `/api/permissions/me` and provides:

- `hasPermission(moduleKey, featureKey)` - Check single permission
- `hasAnyPermission(checks[])` - Check if user has ANY of the specified permissions
- `hasAllPermissions(checks[])` - Check if user has ALL specified permissions
- `canAccessModule(moduleKey)` - Check module access
- `permissions` - Raw permissions map
- `isLoading`, `error`, `refetch()` - State management

## Seeded Modules & Features

The system comes pre-configured with 8 modules:

### 1. User Management (`user_management`)
- View Users
- Create User
- Edit User
- Delete User
- Manage Permissions

### 2. Bank Transactions (`bank_transactions`)
- View Transactions
- Import Statements
- Edit Transaction
- Delete Transaction
- Export Data
- Manage Batches

### 3. Payments (`payments`)
- View Payments
- Create Payment
- Edit Payment
- Delete Payment
- Manage Attachments
- Confirm Attachments

### 4. Counteragents (`counteragents`)
- View Counteragents
- Create Counteragent
- Edit Counteragent
- Delete Counteragent
- View Statements

### 5. Projects (`projects`)
- View Projects
- Create Project
- Edit Project
- Delete Project

### 6. Reports (`reports`)
- View Payment Reports
- View Salary Reports
- View Balances
- Export Reports

### 7. Dictionaries (`dictionaries`)
- View Dictionaries
- Edit Dictionaries
- Manage Banks
- Manage Currencies
- Manage Financial Codes

### 8. System Settings (`system_settings`)
- View Settings
- Edit Settings
- Manage Parsing Rules
- View Audit Log

## Setup & Installation

### 1. Apply Database Migration

The migration has already been created. To apply it:

```powershell
# Applied via custom script (already done)
npx tsx scripts/apply-module-permissions-migration.ts
```

The script creates:
- `Module` table
- `ModuleFeature` table
- `UserPermission` table
- `RolePermission` table

### 2. Generate Prisma Client

```powershell
pnpm prisma generate
```

### 3. Seed Default Modules

```powershell
npx tsx scripts/seed-modules-and-features.ts
```

This creates all 8 modules with their features (can be re-run safely to update).

## Usage Examples

### Grant Permission to a User

```typescript
// Via API
const response = await fetch('/api/permissions/users', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-id-here',
    moduleFeatureUuid: 'feature-uuid-here'
  })
});
```

### Check Permission in API Route

```typescript
import { requirePermission } from '@/lib/permissions';

export async function GET(request: NextRequest) {
  // Throws if user doesn't have permission
  await requirePermission('bank_transactions', 'view');
  
  // Continue with authorized code...
}
```

### Bulk Grant Permissions

```typescript
await fetch('/api/permissions/users', {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 'user-id',
    permissions: [
      'feature-uuid-1',
      'feature-uuid-2',
      'feature-uuid-3'
    ]
  })
});
```

## Admin UI (To Be Created)

Future admin pages will include:

1. **Module Management** (`/admin/modules`)
   - List and manage all modules
   - Create/edit/delete modules
   - Manage features per module

2. **User Permissions** (`/admin/permissions`)
   - Matrix view of users vs. features
   - Bulk permission assignment
   - Permission expiration management

3. **Role Templates** (`/admin/roles`)
   - Define role-based permission templates
   - Assign roles to users

## Security Notes

- All API routes require admin authentication via `requireAdmin()`
- System admins (`system_admin` role) bypass all checks
- Permissions can have expiration dates
- All changes are audit-logged via `logAudit()`
- Permissions are checked on both:
  - User-specific permissions (highest priority)
  - Role-based permissions (fallback)

## Migration Path for Existing Code

To integrate permission checks into existing routes:

```typescript
// Before
export async function GET(request: NextRequest) {
  const session = await requireAuth(); // Only checks if logged in
  // ... code
}

// After
export async function GET(request: NextRequest) {
  await requirePermission('module_key', 'feature_key'); // Checks specific permission
  // ... code
}
```

## Troubleshooting

### Permission denied even though user is admin

- Check user's `role` field - should be `system_admin` for full access
- Check `isAuthorized` field - must be `true`

### Features not showing up

- Verify module and features are active (`is_active = true`)
- Re-run seeding script to ensure all features exist

### Permission not being granted

- Check for unique constraint violations (user already has permission)
- Verify module feature UUID is correct
- Check audit log for failed attempts

## Future Enhancements

### Completed ✅

- [x] Client-side permission hook (`usePermissions`)
- [x] Permission caching layer with automatic invalidation
- [x] Hierarchical permissions (module-level grants)
- [x] Admin UI for module/feature management (`/admin/modules`)
- [x] Admin UI for user permission assignment (`/admin/permissions`)
- [x] Permission analytics and reporting (`/admin/analytics`)

### Planned Enhancements

- [ ] Permission group/bundle management
- [ ] Permission delegation (users granting sub-permissions)

## Admin UI

### Module Management (`/admin/modules`)

Full-featured UI for managing modules and their features:

**Features:**
- Create, edit, and delete modules
- Add, edit, and delete features within modules
- Filter by active/inactive status
- Inline feature management
- Real-time updates with optimistic UI

**Access:** Requires `admin` or `system_admin` role

### Permission Management (`/admin/permissions`)

User permission assignment interface with hierarchical grants:

**Features:**
- User selection sidebar
- Visual permission matrix per module
- Toggle individual features or entire modules at once
- Real-time permission status (No Access / Partial / Full Access)
- Bulk save with conflict detection
- Uses hierarchical permission API for module-level grants

**Access:** Requires `admin` or `system_admin` role

**Usage:**
1. Select a user from the left sidebar
2. View their current permission status for each module
3. Toggle individual features or click "Grant All"/"Revoke All" for entire modules
4. Click "Save All Changes" to persist modifications

### Analytics Dashboard (`/admin/analytics`)

Comprehensive analytics and reporting for permission usage:

**Features:**
- Summary statistics (total users, permissions, averages)
- Most granted features ranking
- Module usage by user count
- User permission distribution (visual breakdown)
- Recent permission changes from audit log
- List of users without any permissions

**Metrics:**
- Total users and active users (with permissions)
- Total permissions granted across all users
- Average permissions per user
- Users without permissions (warning indicator)
- Permission distribution buckets:
  - None (0)
  - Few (1-5)
  - Moderate (6-15)
  - Many (16-30)
  - Extensive (31+)

**Access:** Requires `admin` or `system_admin` role
