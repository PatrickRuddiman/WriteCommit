#!/bin/bash
# Installation script for WriteCommit tool (Linux/macOS)

runtime="linux-x64"
exeName="WriteCommit"

echo "Publishing WriteCommit for $runtime..."
dotnet publish WriteCommit.csproj --configuration Release --runtime $runtime --self-contained true --output "publish/$runtime"

if [ $? -eq 0 ]; then
    echo "Publish successful!"
    
    # Create a directory in user's local bin if it doesn't exist
    localBin="$HOME/.local/bin"
    
    if [ ! -d "$localBin" ]; then
        echo "Creating local bin directory: $localBin"
        mkdir -p "$localBin"
    fi
    
    # Copy the executable to local bin
    sourcePath="publish/$runtime/$exeName"
    targetPath="$localBin/$exeName"
    
    echo "Installing WriteCommit to $targetPath..."
    cp "$sourcePath" "$targetPath"
    chmod +x "$targetPath"
    
    if [ $? -eq 0 ]; then
        echo "✅ WriteCommit installed successfully!"
        
        echo "Note: Make sure $localBin is in your PATH."
        echo "Add this line to your ~/.bashrc or ~/.zshrc:"
        echo "  export PATH=\"$localBin:\$PATH\""
        
        echo ""
        echo "Example usage:"
        echo "  git add ."
        echo "  WriteCommit"
        echo "  WriteCommit --dry-run"
        echo "  WriteCommit --verbose"
    else
        echo "❌ Failed to copy executable to $targetPath"
    fi
else
    echo "❌ Publish failed"
fi
