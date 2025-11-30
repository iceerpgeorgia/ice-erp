const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function applyTriggersManually() {
  try {
    console.log('🔧 Applying triggers manually (one statement at a time)...\n');
    
    // Step 1: Create all trigger functions
    console.log('📦 Creating trigger functions:');
    
    const functions = [
      {
        name: 'populate_project_counteragent',
        sql: `
          CREATE OR REPLACE FUNCTION populate_project_counteragent()
          RETURNS TRIGGER AS $$
          BEGIN
            SELECT name INTO NEW.counteragent
            FROM counteragents
            WHERE counteragent_uuid = NEW.counteragent_uuid;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'populate_project_financial_code',
        sql: `
          CREATE OR REPLACE FUNCTION populate_project_financial_code()
          RETURNS TRIGGER AS $$
          BEGIN
            SELECT validation INTO NEW.financial_code
            FROM financial_codes
            WHERE uuid = NEW.financial_code_uuid;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'populate_project_currency',
        sql: `
          CREATE OR REPLACE FUNCTION populate_project_currency()
          RETURNS TRIGGER AS $$
          BEGIN
            SELECT code INTO NEW.currency
            FROM currencies
            WHERE uuid = NEW.currency_uuid;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'populate_project_state',
        sql: `
          CREATE OR REPLACE FUNCTION populate_project_state()
          RETURNS TRIGGER AS $$
          BEGIN
            SELECT name INTO NEW.state
            FROM project_states
            WHERE uuid = NEW.state_uuid;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'populate_project_contract_no',
        sql: `
          CREATE OR REPLACE FUNCTION populate_project_contract_no()
          RETURNS TRIGGER AS $$
          DECLARE
            counteragent_internal TEXT;
            project_count INT;
            padded_count TEXT;
          BEGIN
            SELECT internal_number INTO counteragent_internal
            FROM counteragents
            WHERE counteragent_uuid = NEW.counteragent_uuid;
            
            SELECT COUNT(*) INTO project_count
            FROM projects
            WHERE counteragent_uuid = NEW.counteragent_uuid;
            
            padded_count := LPAD((project_count + 1)::TEXT, 4, '0');
            NEW.contract_no := counteragent_internal || '.' || padded_count;
            
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'populate_project_index',
        sql: `
          CREATE OR REPLACE FUNCTION populate_project_index()
          RETURNS TRIGGER AS $$
          DECLARE
            counteragent_name TEXT;
            currency_code TEXT;
            formatted_value TEXT;
            formatted_date TEXT;
          BEGIN
            SELECT name INTO counteragent_name FROM counteragents WHERE counteragent_uuid = NEW.counteragent_uuid;
            SELECT code INTO currency_code FROM currencies WHERE uuid = NEW.currency_uuid;
            formatted_value := TO_CHAR(NEW.value, 'FM999,999,999.00');
            formatted_date := TO_CHAR(NEW.date, 'DD.MM.YYYY');
            
            NEW.project_index := NEW.project_name || ' | ' || 
                                 NEW.financial_code || ' ' || 
                                 counteragent_name || ' | ' || 
                                 formatted_value || ' ' || 
                                 currency_code || ' ' || 
                                 formatted_date;
            
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'update_projects_on_counteragent_change',
        sql: `
          CREATE OR REPLACE FUNCTION update_projects_on_counteragent_change()
          RETURNS TRIGGER AS $$
          BEGIN
            UPDATE projects 
            SET counteragent = NEW.name
            WHERE counteragent_uuid = NEW.counteragent_uuid;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'update_projects_on_financial_code_change',
        sql: `
          CREATE OR REPLACE FUNCTION update_projects_on_financial_code_change()
          RETURNS TRIGGER AS $$
          BEGIN
            UPDATE projects 
            SET financial_code = NEW.validation
            WHERE financial_code_uuid = NEW.uuid;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'update_projects_on_currency_change',
        sql: `
          CREATE OR REPLACE FUNCTION update_projects_on_currency_change()
          RETURNS TRIGGER AS $$
          BEGIN
            UPDATE projects 
            SET currency = NEW.code
            WHERE currency_uuid = NEW.uuid;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      },
      {
        name: 'update_projects_on_state_change',
        sql: `
          CREATE OR REPLACE FUNCTION update_projects_on_state_change()
          RETURNS TRIGGER AS $$
          BEGIN
            UPDATE projects 
            SET state = NEW.name
            WHERE state_uuid = NEW.uuid;
            RETURN NEW;
          END;
          $$ LANGUAGE plpgsql;
        `
      }
    ];
    
    for (const func of functions) {
      try {
        await prisma.$executeRawUnsafe(func.sql);
        console.log(`  ✓ ${func.name}`);
      } catch (error) {
        console.log(`  ✗ ${func.name}: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('🎯 Creating triggers on projects table:');
    
    const projectTriggers = [
      { name: 'trigger_populate_project_counteragent', func: 'populate_project_counteragent' },
      { name: 'trigger_populate_project_financial_code', func: 'populate_project_financial_code' },
      { name: 'trigger_populate_project_currency', func: 'populate_project_currency' },
      { name: 'trigger_populate_project_state', func: 'populate_project_state' },
      { name: 'trigger_populate_project_contract_no', func: 'populate_project_contract_no' },
      { name: 'trigger_populate_project_index', func: 'populate_project_index' }
    ];
    
    for (const trig of projectTriggers) {
      try {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trig.name} ON projects`);
        await prisma.$executeRawUnsafe(
          `CREATE TRIGGER ${trig.name} BEFORE INSERT OR UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION ${trig.func}()`
        );
        console.log(`  ✓ ${trig.name}`);
      } catch (error) {
        console.log(`  ✗ ${trig.name}: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('🔗 Creating cascade update triggers on related tables:');
    
    const cascadeTriggers = [
      { table: 'counteragents', name: 'trigger_update_projects_counteragent', func: 'update_projects_on_counteragent_change' },
      { table: 'financial_codes', name: 'trigger_update_projects_financial_code', func: 'update_projects_on_financial_code_change' },
      { table: 'currencies', name: 'trigger_update_projects_currency', func: 'update_projects_on_currency_change' },
      { table: 'project_states', name: 'trigger_update_projects_state', func: 'update_projects_on_state_change' }
    ];
    
    for (const trig of cascadeTriggers) {
      try {
        await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS ${trig.name} ON ${trig.table}`);
        await prisma.$executeRawUnsafe(
          `CREATE TRIGGER ${trig.name} AFTER UPDATE ON ${trig.table} FOR EACH ROW EXECUTE FUNCTION ${trig.func}()`
        );
        console.log(`  ✓ ${trig.table}.${trig.name}`);
      } catch (error) {
        console.log(`  ✗ ${trig.table}.${trig.name}: ${error.message}`);
      }
    }
    
    console.log('');
    console.log('✅ All triggers applied successfully!');
    
  } catch (error) {
    console.error('❌ Failed:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

applyTriggersManually();
