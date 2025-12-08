param(
  [string]$Target = 'windows'
)

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$prebuilt = Join-Path $root 'src-tauri\sidecar\prebuilt'
$targetDir = Join-Path $root 'src-tauri\resources\sidecar'

New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if ($Target -eq 'windows') {
  $src = Join-Path $prebuilt 'dendrite-windows.exe'
  $dest = Join-Path $targetDir 'dendrite.exe'
} else {
  Write-Error "This PowerShell helper expects -Target windows"
  exit 1
}

if (Test-Path $src) {
  Copy-Item -Path $src -Destination $dest -Force
  Write-Output "Copied $src to $dest"
} else {
  Write-Error "No prebuilt sidecar found at $src — CI should populate prebuilt binaries before build."
}
