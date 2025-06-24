# Web installer for WriteCommit tool (Windows)
# Usage: iex (irm https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-web.ps1)

param(
    [string]$InstallDir = "$env:LOCALAPPDATA\Programs\WriteCommit",
    [string]$Version = "latest"
)

$ErrorActionPreference = "Stop"

# Configuration
$Repo = "PatrickRuddiman/Toolkit"
$ToolName = "writecommit"
$Platform = "windows"
$Arch = "x64"
$BinDir = "$env:USERPROFILE\.local\bin"

Write-Host "🔍 Installing WriteCommit for Windows..." -ForegroundColor Cyan

try {
    # Get version info
    if ($Version -eq "latest") {
        Write-Host "📡 Fetching latest release information..." -ForegroundColor Yellow
        $LatestRelease = Invoke-RestMethod -Uri "https://api.github.com/repos/$Repo/releases/latest"
        $Version = $LatestRelease.tag_name

        if ([string]::IsNullOrEmpty($Version)) {
            throw "Failed to get latest release version"
        }
    }
    
    Write-Host "📦 Version: $Version" -ForegroundColor Green

    # Construct download URL - using correct naming pattern
    $AssetName = "$ToolName-$Platform-$Arch-$Version.zip"
    $DownloadUrl = "https://github.com/$Repo/releases/download/$Version/$AssetName"

    Write-Host "⬇️  Downloading $AssetName from $DownloadUrl..." -ForegroundColor Yellow

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

    # Remove old installation if exists
    if (Test-Path $InstallDir) {
        Write-Host "📦 Removing previous installation..." -ForegroundColor Yellow
        Remove-Item $InstallDir -Recurse -Force
    }

    # Create install directory
    Write-Host "📁 Creating install directory: $InstallDir" -ForegroundColor Yellow
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null

    # Extract the entire archive to preserve dependencies
    Write-Host "📂 Extracting archive to $InstallDir..." -ForegroundColor Yellow
    Expand-Archive -Path $ZipPath -DestinationPath $InstallDir -Force

    # Create bin directory if it doesn't exist
    if (!(Test-Path $BinDir)) {
        Write-Host "📁 Creating bin directory: $BinDir" -ForegroundColor Yellow
        New-Item -ItemType Directory -Path $BinDir -Force | Out-Null
    }

    # Create a batch file wrapper in the bin directory
    Write-Host "📥 Creating wrapper script in $BinDir..." -ForegroundColor Yellow
    $WrapperPath = Join-Path $BinDir "WriteCommit.cmd"
    $WrapperContent = @"
@echo off
"$InstallDir\WriteCommit.exe" %*
"@
    Set-Content -Path $WrapperPath -Value $WrapperContent -Encoding ASCII

    # Update PATH - Session
    $currentPath = [Environment]::GetEnvironmentVariable("PATH", "Process")
    if (-not $currentPath.Contains($BinDir)) {
        Write-Host "🔄 Adding $BinDir to current session PATH..." -ForegroundColor Yellow
        $env:PATH = "$BinDir;$env:PATH"
    }

    # Update PATH - User (permanent)
    $persistentPath = [Environment]::GetEnvironmentVariable("PATH", "User")
    if (-not $persistentPath.Contains($BinDir)) {
        Write-Host "🔄 Adding $BinDir to user PATH permanently..." -ForegroundColor Yellow
        [Environment]::SetEnvironmentVariable(
            "PATH", 
            "$BinDir;$persistentPath", 
            "User"
        )
    }

    Write-Host "✅ WriteCommit $Version installed successfully!" -ForegroundColor Green
    Write-Host ""
    Write-Host "📂 Installation directory: $InstallDir" -ForegroundColor White
    Write-Host "🚀 Example usage:" -ForegroundColor White
    Write-Host "   git add ." -ForegroundColor Gray
    Write-Host "   WriteCommit" -ForegroundColor Gray
    Write-Host "   WriteCommit --dry-run" -ForegroundColor Gray
    Write-Host "   WriteCommit --verbose" -ForegroundColor Gray

    # Check if binary is in PATH
    $InPath = $false
    try {
        Get-Command WriteCommit -ErrorAction Stop | Out-Null
        $InPath = $true
    }
    catch {
        # Not in PATH
    }

    if ($InPath) {
        Write-Host ""
        Write-Host "🎉 WriteCommit is ready to use!" -ForegroundColor Green
    }
    else {
        Write-Host ""
        Write-Host "⚠️  You may need to restart your terminal for PATH changes to take effect." -ForegroundColor Yellow
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
