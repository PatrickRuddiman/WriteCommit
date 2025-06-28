# WriteCommit Demo Script
# This script demonstrates the WriteCommit tool functionality

Write-Host "WriteCommit Demo" -ForegroundColor Cyan
Write-Host "================" -ForegroundColor Cyan
Write-Host ""

Write-Host "1. Checking tool installation..." -ForegroundColor Yellow
try {
    $version = WriteCommit --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ WriteCommit is installed" -ForegroundColor Green
    } else {
        Write-Host "❌ WriteCommit is not installed. Run install.ps1 first." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ WriteCommit is not installed. Run install.ps1 first." -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "2. Showing help..." -ForegroundColor Yellow
WriteCommit --help

Write-Host ""
Write-Host "3. Checking git repository status..." -ForegroundColor Yellow
$gitStatus = git status --porcelain 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Not in a git repository" -ForegroundColor Red
} else {
    Write-Host "✅ In a git repository" -ForegroundColor Green
    
    $stagedFiles = git diff --staged --name-only 2>$null
    if ($stagedFiles) {
        Write-Host "✅ Found staged changes:" -ForegroundColor Green
        $stagedFiles | ForEach-Object { Write-Host "  - $_" -ForegroundColor Gray }
        
        Write-Host ""
        Write-Host "4. Running WriteCommit in dry-run mode..." -ForegroundColor Yellow
        Write-Host "   (This will generate a commit message without committing)" -ForegroundColor Gray
        Write-Host ""
        WriteCommit --dry-run --verbose
        
    } else {
        Write-Host "ℹ️ No staged changes found" -ForegroundColor Blue
        Write-Host "   To test the tool:" -ForegroundColor Gray
        Write-Host "   1. Make some changes to files" -ForegroundColor Gray
        Write-Host "   2. Run: git add ." -ForegroundColor Gray
        Write-Host "   3. Run: WriteCommit --dry-run" -ForegroundColor Gray
    }
}

Write-Host ""
Write-Host "Demo completed!" -ForegroundColor Cyan
