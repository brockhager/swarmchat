param(
  [string]$SourcePath = '',
  [string]$OutputDir = 'src-tauri/sidecar/prebuilt'
)

# Require Go to be installed locally for source builds
if (-not (Get-Command go -ErrorAction SilentlyContinue)) {
  Write-Error "Go is not installed on this machine. Please install Go to build Dendrite from source."
  exit 1
}

if ($SourcePath -eq '') {
  Write-Host "No source path provided; assuming dendrite source is in ../dendrite"
  $SourcePath = (Join-Path $PSScriptRoot '..\dendrite')
}

$OutExe = Join-Path $OutputDir 'dendrite-windows.exe'
New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

# Build args — adjust if your Dendrite project's build path differs
Write-Host "Building dendrite from $SourcePath -> $OutExe"
Push-Location -Path $SourcePath
try {
  go build -o "$OutExe" ./cmd/dendrite-monolith-server
  $rc = $LASTEXITCODE
  if ($rc -ne 0) {
    Write-Error "Go build failed with exit code $rc"
    exit $rc
  }
} finally {
  Pop-Location
}

# Compute checksum
try {
  $hash = Get-FileHash -Algorithm SHA256 -Path $OutExe
  Write-Host "Built dendrite-windows.exe: $OutExe ($($hash.Hash))"
} catch {
  Write-Error "Failed to compute file hash: $_"
}

Write-Host "Done. Copy this file to your repo if you want to commit and trigger CI."