#!/usr/bin/env python3
import os
import sys
from pathlib import Path

# Add project to path
sys.path.insert(0, str(Path(__file__).parent))

import openpyxl
from openpyxl.utils import get_column_letter
from subprocess import run, PIPE
import json

def extract_excel_metrics():
    """Extract key data from Alliance Highline Excel file"""
    
    file_path = Path("შპს აი-სი-ი 400017245.xlsx")
    
    if not file_path.exists():
        print(f"ERROR: File not found: {file_path}")
        return None
    
    wb = openpyxl.load_workbook(file_path, data_only=True)
    
    results = {}
    
    for sheet_name in ['L5 13.12.2024', 'L6 02.10.2025', 'L7 02.10.2025']:
        if sheet_name not in wb.sheetnames:
            print(f"Sheet {sheet_name} not found")
            continue
            
        ws = wb[sheet_name]
        
        # Extract key metrics
        sheet_key = sheet_name.split()[0]  # L5, L6, or L7
        
        # Find data in rows 2-6 (invoice data)
        # Row 2: Main invoice
        usd_price = None
        gel_price = None
        factory_no = None
        lift_no = None
        manufacturer = None
        
        # Look for data in row 2
        for row in range(2, 7):
            if ws.cell(row, 4).value == sheet_key:  # Col D = Lift #
                lift_no = ws.cell(row, 4).value
                factory_no = ws.cell(row, 3).value
                manufacturer = ws.cell(row, 2).value
                usd_price = ws.cell(row, 5).value
                gel_price = ws.cell(row, 6).value
                break
        
        # Extract totals from row 7 area
        total_gel = ws.cell(7, 12).value  # Col L = თანხა ₾
        total_nominal = ws.cell(7, 13).value  # Col M = ნომინალი
        
        # Extract payment rows (rows 14-22 for job details)
        payments = []
        for row in range(14, 23):
            block_name = ws.cell(row, 10).value  # Col J = ბლოკი name
            floors = ws.cell(row, 12).value  # Col L = სართ.
            contract_price = ws.cell(row, 13).value  # Col M = საკონტრაქტო
            paid_price = ws.cell(row, 14).value  # Col N = გადახდილი
            delivery = ws.cell(row, 15).value  # Col O = მოწოდების
            transport = ws.cell(row, 16).value  # Col P = ტრანსპორტირება
            total_paid = ws.cell(row, 17).value  # Col Q = ჯამში გადახდილი
            
            if block_name and block_name not in ['#', 'Total']:
                payments.append({
                    'block': block_name,
                    'floors': floors,
                    'contract_price': contract_price,
                    'paid_price': paid_price,
                    'delivery': delivery,
                    'transport': transport,
                    'total_paid': total_paid
                })
        
        results[sheet_key] = {
            'sheet_name': sheet_name,
            'lift_no': lift_no,
            'factory_no': factory_no,
            'manufacturer': manufacturer,
            'usd_price': usd_price,
            'gel_price': gel_price,
            'total_gel': total_gel,
            'total_nominal': total_nominal,
            'payments': payments
        }
    
    return results

def query_database():
    """Query database for Alliance Highline project"""
    
    script = """
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  try {
    const projectResult = await prisma.projects.findFirst({
      where: { project_name: { contains: 'Alliance', mode: 'insensitive' } },
      select: { project_uuid: true, project_name: true, value: true, currency: true }
    });
    
    if (!projectResult) {
      console.log(JSON.stringify({ error: 'Project not found' }));
      return;
    }
    
    const project = projectResult;
    
    // Get jobs for this project
    const rawJobs = await prisma.$queryRawUnsafe(`
      SELECT 
        j.job_uuid, j.job_name, j.selling_price, j.factory_no,
        COALESCE(SUM(pj.amount_account_curr), 0) as total_paid_gel,
        COALESCE(COUNT(pj.id), 0) as distribution_count
      FROM jobs j
      INNER JOIN job_projects jp ON jp.job_uuid = j.job_uuid
      LEFT JOIN payments_jobs pj ON pj.job_uuid = j.job_uuid
      WHERE jp.project_uuid = '` + project.project_uuid + `'
      GROUP BY j.job_uuid, j.job_name, j.selling_price, j.factory_no
      ORDER BY j.job_name ASC
    `);
    
    // Convert BigInt and Decimal to serializable values
    const jobs = rawJobs.map(j => ({
      job_uuid: j.job_uuid,
      job_name: j.job_name,
      selling_price: j.selling_price ? parseFloat(j.selling_price) : 0,
      factory_no: j.factory_no,
      total_paid_gel: j.total_paid_gel ? parseFloat(j.total_paid_gel) : 0,
      distribution_count: Number(j.distribution_count)
    }));
    
    console.log(JSON.stringify({
      project: {
        uuid: project.project_uuid,
        name: project.project_name,
        value: project.value,
        currency: project.currency
      },
      jobs: jobs
    }, null, 2));
    
  } catch (e) {
    console.log(JSON.stringify({ error: e.message, stack: e.stack }));
  } finally {
    await prisma.$disconnect();
  }
})();
"""
    
    # Write script to temp file
    temp_script = Path("_temp_query.js")
    temp_script.write_text(script)
    
    try:
        result = run(['node', str(temp_script)], capture_output=True, text=True, timeout=30)
        if result.returncode == 0:
            return json.loads(result.stdout)
        else:
            print(f"ERROR: {result.stderr}")
            return None
    finally:
        temp_script.unlink(missing_ok=True)

def main():
    print("=" * 100)
    print("ALLIANCE HIGHLINE - EXCEL FILE vs HANDOVERS DATABASE COMPARISON")
    print("=" * 100)
    print()
    
    # Extract Excel data
    print("📊 EXTRACTING EXCEL DATA...")
    excel_data = extract_excel_metrics()
    
    if not excel_data:
        print("ERROR: Could not extract Excel data")
        return
    
    print(f"✅ Extracted data from {len(excel_data)} sheets (L5, L6, L7)")
    print()
    
    # Show Excel summary
    print("=" * 100)
    print("EXCEL FILE SUMMARY")
    print("=" * 100)
    
    total_usd_excel = 0
    total_gel_excel = 0
    
    for sheet_key in ['L5', 'L6', 'L7']:
        if sheet_key not in excel_data:
            continue
        
        data = excel_data[sheet_key]
        print(f"\n📄 Sheet: {data['sheet_name']}")
        print(f"   Lift: {data['lift_no']} | Factory: {data['factory_no']} | Manufacturer: {data['manufacturer']}")
        print(f"   Invoice USD Price: ${data['usd_price']}")
        print(f"   Invoice GEL Price: ₾{data['gel_price']}")
        print(f"   Total GEL (Row 7): ₾{data['total_gel']}")
        print(f"   Total Nominal USD (Row 7): ${data['total_nominal']}")
        
        if data['payments']:
            print(f"\n   Payment Breakdown ({len(data['payments'])} blocks):")
            total_paid_this_sheet = 0
            for payment in data['payments']:
                total_paid = payment['total_paid'] or 0
                total_paid_this_sheet += total_paid
                print(f"      {payment['block']}: {payment['floors']} floors | "
                      f"Contract: ${payment['contract_price']} | "
                      f"Paid: ${payment['paid_price']} | "
                      f"Total: ${total_paid}")
            print(f"   SHEET TOTAL PAID: ${total_paid_this_sheet}")
        
        total_usd_excel += data['usd_price'] or 0
        total_gel_excel += data['total_gel'] or 0
    
    print(f"\n{'=' * 100}")
    print(f"EXCEL TOTALS: USD = ${total_usd_excel} | GEL = ₾{total_gel_excel}")
    print(f"{'=' * 100}\n")
    
    # Query database
    print("🗄️  QUERYING DATABASE...")
    db_data = query_database()
    
    if not db_data or 'error' in db_data:
        print(f"ERROR: {db_data.get('error', 'Unknown error')}")
        return
    
    print("✅ Retrieved database data")
    print()
    
    # Show Database summary
    print("=" * 100)
    print("DATABASE (HANDOVERS) SUMMARY")
    print("=" * 100)
    
    project = db_data.get('project', {})
    jobs = db_data.get('jobs', [])
    
    print(f"\nProject: {project.get('name')} | Value: ${project.get('value')} {project.get('currency')}")
    print(f"Jobs: {len(jobs)} total\n")
    
    total_selling = 0
    total_paid_gel = 0
    
    for job in jobs:
        total_selling += job['selling_price'] or 0
        total_paid_gel += job['total_paid_gel'] or 0
        print(f"  {job['job_name']}: Selling: ${job['selling_price']} | "
              f"Factory: {job['factory_no']} | "
              f"Paid GEL: ₾{job['total_paid_gel']} | "
              f"Distributions: {job['distribution_count']}")
    
    print(f"\n{'=' * 100}")
    print(f"DATABASE TOTALS: Selling Price = ${total_selling} | Paid GEL = ₾{total_paid_gel}")
    print(f"{'=' * 100}\n")
    
    # Comparison
    print("=" * 100)
    print("COMPARISON & DISCREPANCY ANALYSIS")
    print("=" * 100)
    print()
    
    # Map L5, L6, L7 to job names if possible
    print("📌 MAPPING EXCEL LIFTS TO DATABASE JOBS:")
    print(f"\nExcel has 3 IPCs (L5, L6, L7) - representing 3 of 9 jobs")
    print(f"Excel L5-L7 Total USD: ${total_usd_excel}")
    print(f"Database Jobs L5-L7 portion: Need to identify corresponding jobs")
    print()
    
    # Check if there's a mismatch
    excel_per_sheet = {}
    for key in ['L5', 'L6', 'L7']:
        if key in excel_data and excel_data[key]['total_nominal']:
            excel_per_sheet[key] = excel_data[key]['total_nominal']
    
    project_value = float(project.get('value', 0)) if isinstance(project.get('value'), (int, float)) or project.get('value') is None else float(project.get('value', 0) or 0)
    total_selling_float = float(total_selling) if total_selling else 0
    
    print("DETAILED FINDINGS:")
    print(f"  1. Excel file represents: 3 invoices (IPCs) for Lifts L5, L6, L7")
    print(f"  2. Database has: 9 jobs (L0001-L0009) total")
    print(f"  3. Database Selling Price (all 9): ${total_selling_float:,.2f}")
    print(f"  4. Project Value: ${project_value:,.2f}")
    print(f"  5. Difference: ${project_value - total_selling_float:,.2f}")
    print()
    
    if total_selling_float < project_value:
        print(f"⚠️  DISCREPANCY DETECTED:")
        print(f"    Selling prices in database sum to ${total_selling_float:,.2f}")
        print(f"    Project value is ${project_value:,.2f}")
        print(f"    Missing: ${project_value - total_selling_float:,.2f}")
    
    print("\n" + "=" * 100)

if __name__ == '__main__':
    main()
