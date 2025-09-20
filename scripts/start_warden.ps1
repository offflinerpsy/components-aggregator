$ErrorActionPreference = "Continue"
while ($true) {
  try {
    py -m uvicorn tools.warden.app:app --host 127.0.0.1 --port 7755 --reload
  } catch {
    Write-Host "Warden crashed: $($_.Exception.Message)"
  }
  Write-Host "Restarting in 2s..."
  Start-Sleep -Seconds 2
}
