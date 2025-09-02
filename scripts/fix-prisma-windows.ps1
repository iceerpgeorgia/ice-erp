# fix-prisma-windows.ps1
# Kill stray Node/Prisma processes that may lock the query engine on Windows
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "prisma*" -ErrorAction SilentlyContinue | Stop-Process -Force

# Remove read-only/system/hidden attributes from client files (ignore errors)
if (Test-Path "node_modules\.prisma\client") {
  attrib -r -s -h "node_modules\.prisma\client\*" /s | Out-Null
}

# Try to delete the generated client; if locked, attempt a rename first
if (Test-Path "node_modules\.prisma\client") {
  try {
    Remove-Item -Recurse -Force "node_modules\.prisma\client"
  } catch {
    try { Rename-Item "node_modules\.prisma\client" "node_modules\.prisma\client.old" } catch {}
  }
}

# Ensure dependencies are installed
npm ci --no-audit --no-fund

# Regenerate Prisma Client
npx prisma generate
