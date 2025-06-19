# Web installer for WriteCommit tool (Windows)
# Usage: iex (irm https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-web.ps1)

param(
    [string]$InstallDir = "$env:USERPROFILE\.local\bin"
)

$ErrorActionPreference = "Stop"

# Configuration
$Repo = "PatrickRuddiman/Toolkit"
$ToolName = "WriteCommit"
$Runtime = "win-x64"

Write-Host "🔍 Installing WriteCommit for Windows ($Runtime)" -ForegroundColor Cyan

try {
    # Get latest release info
    Write-Host "📡 Fetching latest release information..." -ForegroundColor Yellow
    $LatestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
    $Version = $LatestRelease.tag_name

    if ([string]::IsNullOrEmpty($Version)) {
        throw "Failed to get latest release version"
    }

    Write-Host "📦 Latest version: $Version" -ForegroundColor Green

    # Construct download URL
    $AssetName = "$ToolName-$Version-$Runtime.zip"
    $DownloadUrl = "https://github.com/$Repo/releases/download/$Version/$AssetName"

    Write-Host "⬇️  Downloading $AssetName..." -ForegroundColor Yellow

    # Create temporary directory
    $TempDir = [System.IO.Path]::GetTempPath() + [System.Guid]::NewGuid().ToString()
    New-Item -ItemType Directory -Path $TempDir -Force | Out-Null

    # Download the release
    $ZipPath = Join-Path $TempDir $AssetName
    try {
        Invoke-WebRequest -Uri $DownloadUrl -OutFile $ZipPath
    }
    catch {
        throw "Failed to download $DownloadUrl. Make sure the release exists and contains the asset: $AssetName"
    }

    # Extract the archive
    Write-Host "📂 Extracting archive..." -ForegroundColor Yellow
    $ExtractPath = Join-Path $TempDir "extracted"
    Expand-Archive -Path $ZipPath -DestinationPath $ExtractPath -Force

    # Create install directory if it doesn't exist
    if (!(Test-Path $InstallDir)) {
        Write-Host "📁 Creating install directory: $InstallDir" -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    }

    # Install the binary
    Write-Host "📥 Installing $ToolName to $InstallDir..." -ForegroundColor Yellow
    $ExePath = Join-Path $ExtractPath "$ToolName.exe"
    $TargetPath = Join-Path $InstallDir "$ToolName.exe"
    Copy-Item $ExePath $TargetPath -Force

    Write-Host "✅ $ToolName $Version installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📝 Note: Make sure $InstallDir is in your PATH environment variable." -ForegroundColor Yellow
    Write-Host "   You can add it by running:" -ForegroundColor Gray
    Write-Host "   `$env:PATH += `";$InstallDir`"" -ForegroundColor Gray
    Write-Host ""
    Write-Host "🚀 Example usage:" -ForegroundColor White
    Write-Host "   git add ." -ForegroundColor Gray
    Write-Host "   $ToolName" -ForegroundColor Gray
    Write-Host "   $ToolName --dry-run" -ForegroundColor Gray
    Write-Host "   $ToolName --verbose" -ForegroundColor Gray

    # Check if binary is in PATH
    $InPath = $false
    try {
        Get-Command $ToolName -ErrorAction Stop | Out-Null
        $InPath = $true
    }
    catch {
        # Not in PATH
    }

    if ($InPath) {
        Write-Host ""
        Write-Host "🎉 $ToolName is ready to use!" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "⚠️  $ToolName is not in your PATH. Restart your shell or run:" -ForegroundColor Yellow
        Write-Host "   `$env:PATH += `";$InstallDir`"" -ForegroundColor Gray
    }
}
catch {
    Write-Host "❌ Installation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    # Cleanup
    if (Test-Path $TempDir) {
        Remove-Item $TempDir -Recurse -Force -ErrorAction SilentlyContinue
    }
}
