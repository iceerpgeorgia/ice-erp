import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { prisma } from '@/lib/prisma';

const modulesData = [
  {
    name: 'User Management',
    key: 'user_management',
    description: 'Manage users, roles, and permissions',
    icon: 'users',
    route: '/admin/users',
    displayOrder: 1,
    features: [
      { name: 'View Users', key: 'view', description: 'View user list', featureType: 'view' },
      { name: 'Create User', key: 'create', description: 'Add new users', featureType: 'action' },
      { name: 'Edit User', key: 'edit', description: 'Modify user details', featureType: 'action' },
      { name: 'Delete User', key: 'delete', description: 'Remove users', featureType: 'action' },
      { name: 'Manage Permissions', key: 'permissions', description: 'Assign user permissions', featureType: 'action' },
    ],
  },
  {
    name: 'Bank Transactions',
    key: 'bank_transactions',
    description: 'Import and manage bank statements',
    icon: 'bank',
    route: '/dictionaries/bank-transactions',
    displayOrder: 2,
    features: [
      { name: 'View Transactions', key: 'view', description: 'View bank transactions', featureType: 'view' },
      { name: 'Import Statements', key: 'import', description: 'Import bank XML statements', featureType: 'action' },
      { name: 'Edit Transaction', key: 'edit', description: 'Modify transaction details', featureType: 'action' },
      { name: 'Delete Transaction', key: 'delete', description: 'Remove transactions', featureType: 'action' },
      { name: 'Export Data', key: 'export', description: 'Export transaction data', featureType: 'action' },
      { name: 'Manage Batches', key: 'batches', description: 'Create and manage transaction batches', featureType: 'action' },
    ],
  },
  {
    name: 'Payments',
    key: 'payments',
    description: 'Manage payments and payment ledger',
    icon: 'payment',
    route: '/dictionaries/payments',
    displayOrder: 3,
    features: [
      { name: 'View Payments', key: 'view', description: 'View payment records', featureType: 'view' },
      { name: 'Create Payment', key: 'create', description: 'Create new payments', featureType: 'action' },
      { name: 'Edit Payment', key: 'edit', description: 'Modify payment details', featureType: 'action' },
      { name: 'Delete Payment', key: 'delete', description: 'Remove payments', featureType: 'action' },
      { name: 'Manage Attachments', key: 'attachments', description: 'Upload and manage payment attachments', featureType: 'action' },
      { name: 'Confirm Attachments', key: 'confirm', description: 'Confirm payment attachments', featureType: 'action' },
    ],
  },
  {
    name: 'Counteragents',
    key: 'counteragents',
    description: 'Manage counteragent directory',
    icon: 'building',
    route: '/dictionaries/counteragents',
    displayOrder: 4,
    features: [
      { name: 'View Counteragents', key: 'view', description: 'View counteragent list', featureType: 'view' },
      { name: 'Create Counteragent', key: 'create', description: 'Add new counteragents', featureType: 'action' },
      { name: 'Edit Counteragent', key: 'edit', description: 'Modify counteragent details', featureType: 'action' },
      { name: 'Delete Counteragent', key: 'delete', description: 'Remove counteragents', featureType: 'action' },
      { name: 'View Statements', key: 'statements', description: 'View counteragent statements', featureType: 'view' },
    ],
  },
  {
    name: 'Projects',
    key: 'projects',
    description: 'Manage projects and budgets',
    icon: 'folder',
    route: '/dictionaries/projects',
    displayOrder: 5,
    features: [
      { name: 'View Projects', key: 'view', description: 'View project list', featureType: 'view' },
      { name: 'Create Project', key: 'create', description: 'Create new projects', featureType: 'action' },
      { name: 'Edit Project', key: 'edit', description: 'Modify project details', featureType: 'action' },
      { name: 'Delete Project', key: 'delete', description: 'Remove projects', featureType: 'action' },
    ],
  },
  {
    name: 'Reports',
    key: 'reports',
    description: 'View financial reports and analytics',
    icon: 'chart',
    route: '/reports',
    displayOrder: 6,
    features: [
      { name: 'View Payment Reports', key: 'payments', description: 'View payment reports', featureType: 'view' },
      { name: 'View Salary Reports', key: 'salary', description: 'View salary reports', featureType: 'view' },
      { name: 'View Balances', key: 'balances', description: 'View account balances', featureType: 'view' },
      { name: 'Export Reports', key: 'export', description: 'Export report data', featureType: 'action' },
    ],
  },
  {
    name: 'Dictionaries',
    key: 'dictionaries',
    description: 'Manage reference data and dictionaries',
    icon: 'database',
    route: '/dictionaries',
    displayOrder: 7,
    features: [
      { name: 'View Dictionaries', key: 'view', description: 'Access dictionary listings', featureType: 'view' },
      { name: 'Edit Dictionaries', key: 'edit', description: 'Modify dictionary entries', featureType: 'action' },
      { name: 'Manage Banks', key: 'banks', description: 'Manage bank directory', featureType: 'action' },
      { name: 'Manage Currencies', key: 'currencies', description: 'Manage currency list', featureType: 'action' },
      { name: 'Manage Financial Codes', key: 'financial_codes', description: 'Manage financial code hierarchy', featureType: 'action' },
    ],
  },
  {
    name: 'System Settings',
    key: 'system_settings',
    description: 'System configuration and settings',
    icon: 'settings',
    route: '/admin/settings',
    displayOrder: 8,
    features: [
      { name: 'View Settings', key: 'view', description: 'View system settings', featureType: 'view' },
      { name: 'Edit Settings', key: 'edit', description: 'Modify system configuration', featureType: 'action' },
      { name: 'Manage Integrations', key: 'integrations', description: 'Configure external integrations', featureType: 'action' },
    ],
  },
];

export async function POST() {
  try {
    const authResult = await requireAdmin();
    if (authResult instanceof NextResponse) return authResult;

    const results = {
      modulesCreated: 0,
      modulesUpdated: 0,
      featuresCreated: 0,
      featuresUpdated: 0,
    };

    for (const moduleData of modulesData) {
      // Check if module exists
      const existingModule = await prisma.module.findUnique({
        where: { key: moduleData.key },
        select: { id: true },
      });

      // Upsert module
      const moduleRecord = await prisma.module.upsert({
        where: { key: moduleData.key },
        create: {
          name: moduleData.name,
          key: moduleData.key,
          description: moduleData.description,
          icon: moduleData.icon,
          route: moduleData.route,
          displayOrder: moduleData.displayOrder,
          isActive: true,
        },
        update: {
          name: moduleData.name,
          description: moduleData.description,
          icon: moduleData.icon,
          route: moduleData.route,
          displayOrder: moduleData.displayOrder,
        },
      });

      if (existingModule) {
        results.modulesUpdated++;
      } else {
        results.modulesCreated++;
      }

      // Upsert features
      for (const featureData of moduleData.features) {
        const existingFeature = await prisma.moduleFeature.findFirst({
          where: {
            moduleId: moduleRecord.id,
            key: featureData.key,
          },
        });

        await prisma.moduleFeature.upsert({
          where: {
            moduleId_key: {
              moduleId: moduleRecord.id,
              key: featureData.key,
            },
          },
          create: {
            moduleId: moduleRecord.id,
            moduleUuid: moduleRecord.uuid,
            name: featureData.name,
            key: featureData.key,
            description: featureData.description,
            featureType: featureData.featureType,
            isActive: true,
          },
          update: {
            name: featureData.name,
            description: featureData.description,
            featureType: featureData.featureType,
          },
        });

        if (existingFeature) {
          results.featuresUpdated++;
        } else {
          results.featuresCreated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Modules seeded successfully',
      results,
    });
  } catch (error: any) {
    console.error('Error seeding modules:', error);
    return NextResponse.json(
      { error: 'Failed to seed modules', details: error.message },
      { status: 500 }
    );
  }
}
