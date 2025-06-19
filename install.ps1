# Installation script for WriteCommit tool (Windows)

$runtime = "win-x64"
$exeName = "WriteCommit.exe"

Write-Host "Publishing WriteCommit for $runtime..." -ForegroundColor Cyan
dotnet publish WriteCommit.csproj --configuration Release --runtime $runtime --self-contained true --output "publish/$runtime"

if ($LASTEXITCODE -eq 0) {
    Write-Host "Publish successful!" -ForegroundColor Green
    
    # Create a directory in user's local bin if it doesn't exist
    $localBin = "$env:USERPROFILE\.local\bin"
    
    if (!(Test-Path $localBin)) {
        Write-Host "Creating local bin directory: $localBin" -ForegroundColor Cyan
        New-Item -ItemType Directory -Path $localBin -Force | Out-Null
    }
    
    # Copy the executable to local bin
    $sourcePath = "publish\$runtime\$exeName"
    $targetPath = "$localBin\$exeName"
    
    Write-Host "Installing WriteCommit to $targetPath..." -ForegroundColor Cyan
    Copy-Item $sourcePath $targetPath -Force
    
    if ($LASTEXITCODE -eq 0 -or $?) {
        Write-Host "✅ WriteCommit installed successfully!" -ForegroundColor Green
        
        Write-Host "Note: Make sure $localBin is in your PATH environment variable." -ForegroundColor Yellow
        Write-Host "You can add it by running:" -ForegroundColor Gray
        Write-Host "  `$env:PATH += `";$localBin`"" -ForegroundColor Gray
        
        Write-Host ""
        Write-Host "Example usage:" -ForegroundColor White
        Write-Host "  git add ." -ForegroundColor Gray
        Write-Host "  WriteCommit" -ForegroundColor Gray
        Write-Host "  WriteCommit --dry-run" -ForegroundColor Gray
        Write-Host "  WriteCommit --verbose" -ForegroundColor Gray
    }
    else {
        Write-Host "❌ Failed to copy executable to $targetPath" -ForegroundColor Red
    }
}
else {
    Write-Host "❌ Publish failed" -ForegroundColor Red
}
