import zipfile
import subprocess
import tempfile
import os
from pathlib import Path

# Strategy: Use VBScript to open Excel file, recalculate, and save
# This ensures cached values are present in the file

test_file = 'd:/final-test.xlsx'
output_file = 'd:/final-test-recalculated.xlsx'

vbscript = """
Set xlApp = CreateObject("Excel.Application")
xlApp.Visible = False
xlApp.DisplayAlerts = False

On Error Resume Next
Set xlBook = xlApp.Workbooks.Open("{test_file}", , False)

If Not IsEmpty(xlBook) Then
    ' Force calculation
    xlApp.CalculateFullRebuild
    ' Wait for calculation
    xlApp.Calculate
    
    ' Resave to preserve cached values
    xlBook.SaveAs "{output_file}"
    xlBook.Close
    xlApp.Quit
    
    WScript.Echo "Success"
Else
    WScript.Echo "Failed to open: " & "{test_file}"
    xlApp.Quit
End If

Set xlBook = Nothing
Set xlApp = Nothing
""".format(test_file=test_file, output_file=output_file)

# Check if Excel is available
import shutil
vbs_path = None

try:
    vbs_path = r'C:\Windows\Temp\excel_recalc.vbs'
    with open(vbs_path, 'w') as f:
        f.write(vbscript)
    
    print("Running VBScript to recalculate Excel formulas...")
    result = subprocess.run(['cscript.exe', vbs_path], capture_output=True, text=True, timeout=30)
    
    if result.returncode == 0:
        print(f"✓ VBScript completed: {result.stdout.strip()}")
        if os.path.exists(output_file):
            print(f"✓ Output file created: {output_file}")
            print(f"  File size: {os.path.getsize(output_file)} bytes")
        else:
            print("⚠ Output file not created")
    else:
        print(f"✗ VBScript error: {result.stderr}")
        
except Exception as e:
    print(f"Error: {e}")
finally:
    if vbs_path and os.path.exists(vbs_path):
        os.remove(vbs_path)
