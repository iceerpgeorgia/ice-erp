#!/usr/bin/env python3
import openpyxl
from pathlib import Path
import sys

def extract_payment_distribution():
    """Extract payment distribution per elevator from all sheets"""
    
    file_path = Path("შპს აი-სი-ი 400017245.xlsx")
    
    if not file_path.exists():
        print(f"ERROR: File not found: {file_path}")
        return None
    
    wb = openpyxl.load_workbook(file_path, data_only=True)
    
    # Collect data from all sheets
    all_elevators = {}
    
    for sheet_name in ['L5 13.12.2024', 'L6 02.10.2025', 'L7 02.10.2025']:
        if sheet_name not in wb.sheetnames:
            print(f"Sheet {sheet_name} not found")
            continue
        
        ws = wb[sheet_name]
        
        # Extract payment rows (rows 14-22 contain elevator data)
        for row in range(14, 23):
            elevator_id = ws.cell(row, 10).value  # Col J = ბლოკი/Elevator ID
            floors = ws.cell(row, 12).value  # Col L = სართ./Floors
            contract_price = ws.cell(row, 13).value  # Col M = საკონტრაქტო/Contract Price
            paid_price = ws.cell(row, 14).value  # Col N = გადახდილი/Paid Price
            delivery = ws.cell(row, 15).value  # Col O = მოწოდების/Delivery
            transport = ws.cell(row, 16).value  # Col P = ტრანსპორტირება/Transport
            total_paid = ws.cell(row, 17).value  # Col Q = ჯამში გადახდილი/Total Paid
            
            # Skip header rows and invalid data
            if not elevator_id or elevator_id in ['#', 'Total', 'ბლოკი']:
                continue
            
            # Initialize elevator entry if not exists
            if elevator_id not in all_elevators:
                all_elevators[elevator_id] = {
                    'sheets': {},
                    'floors': floors,
                    'total_contract': 0,
                    'total_paid': 0,
                    'total_delivery': 0,
                    'total_transport': 0,
                    'grand_total': 0,
                    'ipc_count': 0
                }
            
            # Store data by sheet
            sheet_short = sheet_name.split()[0]  # L5, L6, or L7
            all_elevators[elevator_id]['sheets'][sheet_short] = {
                'contract_price': contract_price or 0,
                'paid_price': paid_price or 0,
                'delivery': delivery or 0,
                'transport': transport or 0,
                'total_paid': total_paid or 0
            }
            
            # Add to totals
            all_elevators[elevator_id]['total_contract'] += contract_price or 0
            all_elevators[elevator_id]['total_paid'] += paid_price or 0
            all_elevators[elevator_id]['total_delivery'] += delivery or 0
            all_elevators[elevator_id]['total_transport'] += transport or 0
            all_elevators[elevator_id]['grand_total'] += total_paid or 0
            all_elevators[elevator_id]['ipc_count'] = len(all_elevators[elevator_id]['sheets'])
    
    return all_elevators

def print_payment_distribution(elevators):
    """Print payment distribution in a readable format"""
    
    print("\n" + "=" * 140)
    print("PAYMENT DISTRIBUTION PER ELEVATOR - Alliance Highline Project")
    print("=" * 140)
    print()
    
    # Sort elevators by ID
    sorted_elevators = sorted(elevators.items(), key=lambda x: x[0])
    
    # Summary table
    print("SUMMARY TABLE - TOTAL PAYMENTS PER ELEVATOR ACROSS ALL IPCs (L5, L6, L7)")
    print("-" * 140)
    print(f"{'Elevator':<12} {'Floors':<8} {'IPC Count':<12} {'Contract Price':<18} {'Paid Price':<18} {'Delivery':<15} {'Transport':<15} {'TOTAL PAID':<18}")
    print("-" * 140)
    
    grand_total_contract = 0
    grand_total_paid = 0
    grand_total_delivery = 0
    grand_total_transport = 0
    grand_total_all = 0
    
    for elev_id, data in sorted_elevators:
        grand_total_contract += data['total_contract']
        grand_total_paid += data['total_paid']
        grand_total_delivery += data['total_delivery']
        grand_total_transport += data['total_transport']
        grand_total_all += data['grand_total']
        
        print(f"{elev_id:<12} {str(data['floors']):<8} {str(data['ipc_count']):<12} "
              f"${data['total_contract']:>15,.2f} ${data['total_paid']:>15,.2f} "
              f"${data['total_delivery']:>13,.2f} ${data['total_transport']:>13,.2f} "
              f"${data['grand_total']:>15,.2f}")
    
    print("-" * 140)
    print(f"{'TOTALS':<12} {'':<8} {'':<12} "
          f"${grand_total_contract:>15,.2f} ${grand_total_paid:>15,.2f} "
          f"${grand_total_delivery:>13,.2f} ${grand_total_transport:>13,.2f} "
          f"${grand_total_all:>15,.2f}")
    print("=" * 140)
    print()
    
    # Detailed breakdown per elevator
    print("\nDETAILED BREAKDOWN PER ELEVATOR")
    print("=" * 140)
    
    for elev_id, data in sorted_elevators:
        print(f"\n📌 ELEVATOR: {elev_id}")
        print(f"   Floors: {data['floors']} | Appears in {data['ipc_count']} IPCs (L5, L6, L7)")
        print("   " + "-" * 136)
        print(f"   {'IPC':<8} {'Contract Price':<18} {'Paid Price':<18} {'Delivery':<15} {'Transport':<15} {'Total':<18}")
        print("   " + "-" * 136)
        
        for sheet_id in sorted(data['sheets'].keys()):
            sheet_data = data['sheets'][sheet_id]
            print(f"   {sheet_id:<8} ${sheet_data['contract_price']:>15,.2f} "
                  f"${sheet_data['paid_price']:>15,.2f} ${sheet_data['delivery']:>13,.2f} "
                  f"${sheet_data['transport']:>13,.2f} ${sheet_data['total_paid']:>15,.2f}")
        
        print("   " + "-" * 136)
        print(f"   {'SUBTOTAL':<8} ${data['total_contract']:>15,.2f} "
              f"${data['total_paid']:>15,.2f} ${data['total_delivery']:>13,.2f} "
              f"${data['total_transport']:>13,.2f} ${data['grand_total']:>15,.2f}")
        print()
    
    # Statistics
    print("\n" + "=" * 140)
    print("STATISTICS")
    print("=" * 140)
    print(f"\nTotal Elevators: {len(elevators)}")
    print(f"Total IPCs: 3 (L5, L6, L7)")
    print(f"Average Payment per Elevator: ${grand_total_all / len(elevators):,.2f}")
    print(f"Maximum Payment per Elevator: ${max(e['grand_total'] for e in elevators.values()):,.2f}")
    print(f"Minimum Payment per Elevator: ${min(e['grand_total'] for e in elevators.values()):,.2f}")
    print(f"\nTotal Contract Value: ${grand_total_contract:,.2f}")
    print(f"Total Paid Amount: ${grand_total_paid:,.2f}")
    print(f"Total Delivery Costs: ${grand_total_delivery:,.2f}")
    print(f"Total Transport Costs: ${grand_total_transport:,.2f}")
    print(f"GRAND TOTAL (All Payments): ${grand_total_all:,.2f}")
    print(f"\nPayment Coverage: {(grand_total_paid / grand_total_contract * 100):.2f}% of contract value")
    print(f"Delivery + Transport per Elevator Average: ${(grand_total_delivery + grand_total_transport) / len(elevators):,.2f}")
    
    print("\n" + "=" * 140)

def main():
    print("Extracting payment distribution from Excel file...")
    print("File: შპს აი-სი-ი 400017245.xlsx")
    
    elevators = extract_payment_distribution()
    
    if not elevators:
        print("ERROR: Could not extract data")
        return
    
    print_payment_distribution(elevators)

if __name__ == '__main__':
    main()
