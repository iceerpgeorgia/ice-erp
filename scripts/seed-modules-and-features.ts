/**
 * Seed default modules and features for the permission system
 * Run with: npx tsx scripts/seed-modules-and-features.ts
 */
import { config } from 'dotenv';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';

// Load environment variables
config({ path: resolve(process.cwd(), '.env.local') });

const prisma = new PrismaClient();

interface ModuleSeed {
  name: string;
  key: string;
  description: string;
  icon: string;
  route: string;
  displayOrder: number;
  features: FeatureSeed[];
}

interface FeatureSeed {
  name: string;
  key: string;
  description: string;
  featureType: string;
}

const modulesData: ModuleSeed[] = [
  {
    name: 'User Management',
    key: 'user_management',
    description: 'Manage users, roles, and permissions',
    icon: 'users',
    route: '/admin/users',
    displayOrder: 1,
    features: [
      { name: 'View Users', key: 'view', description: 'View user list', featureType: 'action' },
      { name: 'Create User', key: 'create', description: 'Create new users', featureType: 'action' },
      { name: 'Edit User', key: 'edit', description: 'Edit user details', featureType: 'action' },
      { name: 'Delete User', key: 'delete', description: 'Delete users', featureType: 'action' },
      { name: 'Manage Permissions', key: 'manage_permissions', description: 'Assign permissions to users', featureType: 'action' },
    ],
  },
  {
    name: 'Bank Transactions',
    key: 'bank_transactions',
    description: 'Manage bank statements and transactions',
    icon: 'bank',
    route: '/bank-transactions',
    displayOrder: 2,
    features: [
      { name: 'View Transactions', key: 'view', description: 'View bank transactions', featureType: 'action' },
      { name: 'Import Statements', key: 'import', description: 'Import bank statements (XML)', featureType: 'action' },
      { name: 'Edit Transaction', key: 'edit', description: 'Edit transaction details', featureType: 'action' },
      { name: 'Delete Transaction', key: 'delete', description: 'Delete transactions', featureType: 'action' },
      { name: 'Export Data', key: 'export', description: 'Export transaction data', featureType: 'action' },
      { name: 'Manage Batches', key: 'manage_batches', description: 'Create and manage transaction batches', featureType: 'action' },
    ],
  },
  {
    name: 'Payments',
    key: 'payments',
    description: 'Manage payments and payment ledger',
    icon: 'credit-card',
    route: '/payments',
    displayOrder: 3,
    features: [
      { name: 'View Payments', key: 'view', description: 'View payment list', featureType: 'action' },
      { name: 'Create Payment', key: 'create', description: 'Create new payments', featureType: 'action' },
      { name: 'Edit Payment', key: 'edit', description: 'Edit payment details', featureType: 'action' },
      { name: 'Delete Payment', key: 'delete', description: 'Delete payments', featureType: 'action' },
      { name: 'Manage Attachments', key: 'manage_attachments', description: 'Upload and manage payment attachments', featureType: 'action' },
      { name: 'Confirm Attachments', key: 'confirm_attachments', description: 'Confirm attachment processing', featureType: 'action' },
    ],
  },
  {
    name: 'Counteragents',
    key: 'counteragents',
    description: 'Manage business counteragents and contacts',
    icon: 'briefcase',
    route: '/dictionaries/counteragents',
    displayOrder: 4,
    features: [
      { name: 'View Counteragents', key: 'view', description: 'View counteragent list', featureType: 'action' },
      { name: 'Create Counteragent', key: 'create', description: 'Create new counteragents', featureType: 'action' },
      { name: 'Edit Counteragent', key: 'edit', description: 'Edit counteragent details', featureType: 'action' },
      { name: 'Delete Counteragent', key: 'delete', description: 'Delete counteragents', featureType: 'action' },
      { name: 'View Statements', key: 'view_statements', description: 'View counteragent statements', featureType: 'action' },
    ],
  },
  {
    name: 'Projects',
    key: 'projects',
    description: 'Manage projects and project codes',
    icon: 'folder',
    route: '/dictionaries/projects',
    displayOrder: 5,
    features: [
      { name: 'View Projects', key: 'view', description: 'View project list', featureType: 'action' },
      { name: 'Create Project', key: 'create', description: 'Create new projects', featureType: 'action' },
      { name: 'Edit Project', key: 'edit', description: 'Edit project details', featureType: 'action' },
      { name: 'Delete Project', key: 'delete', description: 'Delete projects', featureType: 'action' },
    ],
  },
  {
    name: 'Reports',
    key: 'reports',
    description: 'Access financial reports and analytics',
    icon: 'chart-bar',
    route: '/reports',
    displayOrder: 6,
    features: [
      { name: 'View Payment Reports', key: 'view_payment_reports', description: 'View payment statement reports', featureType: 'action' },
      { name: 'View Salary Reports', key: 'view_salary_reports', description: 'View salary reports', featureType: 'action' },
      { name: 'View Balances', key: 'view_balances', description: 'View bank account balances', featureType: 'action' },
      { name: 'Export Reports', key: 'export', description: 'Export report data', featureType: 'action' },
    ],
  },
  {
    name: 'Dictionaries',
    key: 'dictionaries',
    description: 'Manage system dictionaries and reference data',
    icon: 'book',
    route: '/dictionaries',
    displayOrder: 7,
    features: [
      { name: 'View Dictionaries', key: 'view', description: 'View dictionary data', featureType: 'action' },
      { name: 'Edit Dictionaries', key: 'edit', description: 'Edit dictionary entries', featureType: 'action' },
      { name: 'Manage Banks', key: 'manage_banks', description: 'Manage bank directory', featureType: 'action' },
      { name: 'Manage Currencies', key: 'manage_currencies', description: 'Manage currencies', featureType: 'action' },
      { name: 'Manage Financial Codes', key: 'manage_financial_codes', description: 'Manage financial codes', featureType: 'action' },
    ],
  },
  {
    name: 'System Settings',
    key: 'system_settings',
    description: 'Configure system settings and preferences',
    icon: 'settings',
    route: '/admin/settings',
    displayOrder: 8,
    features: [
      { name: 'View Settings', key: 'view', description: 'View system settings', featureType: 'action' },
      { name: 'Edit Settings', key: 'edit', description: 'Modify system settings', featureType: 'action' },
      { name: 'Manage Parsing Rules', key: 'manage_parsing_rules', description: 'Configure bank statement parsing rules', featureType: 'action' },
      { name: 'View Audit Log', key: 'view_audit_log', description: 'Access system audit logs', featureType: 'action' },
    ],
  },
];

async function main() {
  console.log('🌱 Seeding modules and features...\n');

  let modulesCreated = 0;
  let modulesUpdated = 0;
  let featuresCreated = 0;
  let featuresUpdated = 0;

  for (const moduleData of modulesData) {
    console.log(`📦 Processing module: ${moduleData.name}`);

    // Check if module exists
    let module = await prisma.module.findUnique({
      where: { key: moduleData.key },
    });

    if (module) {
      // Update existing module
      module = await prisma.module.update({
        where: { key: moduleData.key },
        data: {
          name: moduleData.name,
          description: moduleData.description,
          icon: moduleData.icon,
          route: moduleData.route,
          displayOrder: moduleData.displayOrder,
        },
      });
      modulesUpdated++;
      console.log(`   ✏️  Updated module`);
    } else {
      // Create new module
      module = await prisma.module.create({
        data: {
          name: moduleData.name,
          key: moduleData.key,
          description: moduleData.description,
          icon: moduleData.icon,
          route: moduleData.route,
          displayOrder: moduleData.displayOrder,
          isActive: true,
        },
      });
      modulesCreated++;
      console.log(`   ✅ Created module`);
    }

    // Process features for this module
    for (const featureData of moduleData.features) {
      const existing = await prisma.moduleFeature.findFirst({
        where: {
          moduleId: module.id,
          key: featureData.key,
        },
      });

      if (existing) {
        // Update existing feature
        await prisma.moduleFeature.update({
          where: { uuid: existing.uuid },
          data: {
            name: featureData.name,
            description: featureData.description,
            featureType: featureData.featureType,
          },
        });
        featuresUpdated++;
        console.log(`      ✏️  Updated feature: ${featureData.name}`);
      } else {
        // Create new feature
        await prisma.moduleFeature.create({
          data: {
            moduleId: module.id,
            moduleUuid: module.uuid,
            name: featureData.name,
            key: featureData.key,
            description: featureData.description,
            featureType: featureData.featureType,
            isActive: true,
          },
        });
        featuresCreated++;
        console.log(`      ✅ Created feature: ${featureData.name}`);
      }
    }

    console.log('');
  }

  console.log('🎉 Seeding complete!\n');
  console.log(`📊 Summary:`);
  console.log(`   Modules: ${modulesCreated} created, ${modulesUpdated} updated`);
  console.log(`   Features: ${featuresCreated} created, ${featuresUpdated} updated`);
}

main()
  .catch((error) => {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
