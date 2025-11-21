# Generate a secure NEXTAUTH_SECRET
# Run this and use the output as your NEXTAUTH_SECRET environment variable

$rng = New-Object System.Security.Cryptography.RNGCryptoServiceProvider
$bytes = New-Object byte[] 32
$rng.GetBytes($bytes)
$secret = [System.Convert]::ToBase64String($bytes)
Write-Host "Your NEXTAUTH_SECRET:"
Write-Host $secret
Write-Host "`nAdd this to your Vercel environment variables!"
