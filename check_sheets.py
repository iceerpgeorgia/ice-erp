import zipfile
import os

# Check filesystem template
fs_path = os.path.join(os.getcwd(), 'public', 'Handover Tamplate New.xlsx')
print(f"Filesystem template path: {fs_path}")
print(f"Exists: {os.path.exists(fs_path)}")

if os.path.exists(fs_path):
    try:
        with zipfile.ZipFile(fs_path, 'r') as z:
            print("\nAll files in template ZIP:")
            for name in sorted(z.namelist()):
                print(f"  {name}")
            
            print("\n\nSheet XML files:")
            for name in z.namelist():
                if 'worksheets/sheet' in name and name.endswith('.xml'):
                    print(f"\n=== {name} ===")
                    with z.open(name) as f:
                        content = f.read().decode('utf-8', errors='ignore')
                        # Show first 1000 chars
                        print(content[:1000])
    except Exception as e:
        print(f"Error: {e}")
