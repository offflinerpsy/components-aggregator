param(
  [int]$idle=20,
  [int]$timeout=180,
  [Parameter(Mandatory=$true, Position=0, ValueFromRemainingArguments=$true)]
  [string[]]$cmd
)
$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = "powershell"
$psi.Arguments = "-NoLogo -NoProfile -Command `"& { " + ($cmd -join ' ') + " }`" 
$psi.UseShellExecute = $false
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$p = New-Object System.Diagnostics.Process
$p.StartInfo = $psi
$null = $p.Start()

$last = Get-Date
$pattern = "press any key|done|completed|all tests passed"
$timer = [System.Diagnostics.Stopwatch]::StartNew()

while(-not $p.HasExited){
  if ($p.StandardOutput.Peek() -ge 0) { 
    $o = $p.StandardOutput.ReadLine()
    if ($o) { Write-Host $o; $last = Get-Date; if ($o -match $pattern) { $p.CloseMainWindow() | Out-Null; $p.Kill() } }
  }
  if ($p.StandardError.Peek() -ge 0) { 
    $e = $p.StandardError.ReadLine()
    if ($e) { Write-Host $e; $last = Get-Date; if ($e -match $pattern) { $p.CloseMainWindow() | Out-Null; $p.Kill() } }
  }
  if ($timer.Elapsed.TotalSeconds -ge $timeout -or ((Get-Date) - $last).TotalSeconds -ge $idle) { 
    Write-Warning "[watchdog] timeout/idle -> kill"
    $p.Kill()
    break
  }
  Start-Sleep -Milliseconds 200
}
exit 0
