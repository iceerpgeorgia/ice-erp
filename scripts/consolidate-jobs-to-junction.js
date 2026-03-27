/**
 * Consolidate duplicate job rows into single entries using job_projects junction table.
 *
 * Before: Each project binding = separate job row (siblings share name+insider+brand)
 * After:  One job row per unique (job_name, insider_uuid, brand_uuid), projects linked via job_projects
 *
 * Steps:
 * 1. Backfill job_projects from jobs.project_uuid for any missing entries
 * 2. Find groups of active duplicate jobs
 * 3. For each group: pick canonical, migrate payments, deactivate duplicates
 * 4. Make project_uuid nullable
 */

const { PrismaClient } = require('@prisma/client');
BigInt.prototype.toJSON = function () { return Number(this); };

const prisma = new PrismaClient();

async function main() {
  console.log('=== Jobs Consolidation Migration ===\n');

  // Step 1: Backfill job_projects
  console.log('Step 1: Backfilling job_projects from jobs.project_uuid...');
  const backfilled = await prisma.$executeRawUnsafe(`
    INSERT INTO job_projects (job_uuid, project_uuid)
    SELECT j.job_uuid, j.project_uuid
    FROM jobs j
    WHERE j.is_active = true
      AND j.project_uuid IS NOT NULL
    ON CONFLICT (job_uuid, project_uuid) DO NOTHING
  `);
  console.log(`  Backfilled ${backfilled} new job_projects entries.\n`);

  // Step 2: Find duplicate groups
  console.log('Step 2: Finding duplicate job groups...');
  const groups = await prisma.$queryRawUnsafe(`
    SELECT
      lower(job_name) as job_name_lower,
      insider_uuid,
      COALESCE(brand_uuid::text, '') as brand_key,
      COUNT(*) as cnt,
      array_agg(id ORDER BY id ASC) as ids,
      array_agg(job_uuid::text ORDER BY id ASC) as uuids,
      array_agg(project_uuid::text ORDER BY id ASC) as project_uuids
    FROM jobs
    WHERE is_active = true
    GROUP BY lower(job_name), insider_uuid, COALESCE(brand_uuid::text, '')
    HAVING COUNT(*) > 1
    ORDER BY COUNT(*) DESC
  `);
  console.log(`  Found ${groups.length} groups with duplicates.\n`);

  if (groups.length === 0) {
    console.log('  No duplicates to consolidate.');
  }

  let totalDeduplicated = 0;
  let totalPaymentsUpdated = 0;

  for (const group of groups) {
    const canonicalId = Number(group.ids[0]);
    const canonicalUuid = group.uuids[0];
    const duplicateIds = group.ids.slice(1).map(Number);
    const duplicateUuids = group.uuids.slice(1);

    console.log(`  Group: "${group.job_name_lower}" (${group.cnt} rows)`);
    console.log(`    Canonical: id=${canonicalId}, uuid=${canonicalUuid}`);
    console.log(`    Duplicates: ids=${duplicateIds.join(', ')}`);

    // Ensure all project bindings are in job_projects under canonical UUID
    for (let i = 0; i < group.uuids.length; i++) {
      const projUuid = group.project_uuids[i];
      if (projUuid) {
        await prisma.$executeRawUnsafe(`
          INSERT INTO job_projects (job_uuid, project_uuid)
          VALUES ($1::uuid, $2::uuid)
          ON CONFLICT (job_uuid, project_uuid) DO NOTHING
        `, canonicalUuid, projUuid);
      }
    }

    // Move payments from duplicate job_uuids to canonical
    for (const dupUuid of duplicateUuids) {
      const updated = await prisma.$executeRawUnsafe(`
        UPDATE payments
        SET job_uuid = $1::uuid, updated_at = CURRENT_TIMESTAMP
        WHERE job_uuid = $2::uuid
      `, canonicalUuid, dupUuid);
      if (updated > 0) {
        console.log(`    Moved ${updated} payments from ${dupUuid} to ${canonicalUuid}`);
        totalPaymentsUpdated += updated;
      }
    }

    // Deactivate duplicates
    for (const dupId of duplicateIds) {
      await prisma.$executeRawUnsafe(`
        UPDATE jobs SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1
      `, dupId);
    }

    // Remove job_projects entries for deactivated duplicate UUIDs
    for (const dupUuid of duplicateUuids) {
      await prisma.$executeRawUnsafe(`
        DELETE FROM job_projects WHERE job_uuid = $1::uuid
      `, dupUuid);
    }

    totalDeduplicated += duplicateIds.length;
    console.log(`    Deactivated ${duplicateIds.length} duplicate(s).\n`);
  }

  // Step 3: Make project_uuid nullable
  console.log('Step 3: Making project_uuid nullable...');
  await prisma.$executeRawUnsafe(`
    ALTER TABLE jobs ALTER COLUMN project_uuid DROP NOT NULL
  `);
  console.log('  project_uuid is now nullable.\n');

  // Summary
  const activeJobs = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM jobs WHERE is_active = true`);
  const totalJobProjects = await prisma.$queryRawUnsafe(`SELECT COUNT(*)::int as cnt FROM job_projects`);
  
  console.log('=== Summary ===');
  console.log(`  Duplicate rows deactivated: ${totalDeduplicated}`);
  console.log(`  Payments references updated: ${totalPaymentsUpdated}`);
  console.log(`  Active jobs remaining: ${activeJobs[0].cnt}`);
  console.log(`  Total job_projects entries: ${totalJobProjects[0].cnt}`);
  console.log('\nDone!');

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});
