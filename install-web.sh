#!/bin/bash
# Web installer for WriteCommit tool (Linux/macOS)
# Usage: curl -sSL https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-web.sh | bash

set -e

# Configuration
REPO="PatrickRuddiman/Toolkit"
TOOL_NAME="WriteCommit"
INSTALL_DIR="$HOME/.local/bin"

# Detect architecture
ARCH=$(uname -m)
case $ARCH in
    x86_64)
        RUNTIME="linux-x64"
        ;;
    aarch64|arm64)
        RUNTIME="linux-arm64"
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

# Detect OS
OS=$(uname -s)
case $OS in
    Linux)
        RUNTIME="linux-x64"
        ;;
    Darwin)
        RUNTIME="osx-x64"
        ;;
    *)
        echo "❌ Unsupported OS: $OS"
        echo "This script is for Linux and macOS only. For Windows, use the PowerShell installer."
        exit 1
        ;;
esac

echo "🔍 Detecting platform: $OS ($ARCH) -> $RUNTIME"

# Get latest release info
echo "📡 Fetching latest release information..."
LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")
VERSION=$(echo "$LATEST_RELEASE" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

if [ -z "$VERSION" ]; then
    echo "❌ Failed to get latest release version"
    exit 1
fi

echo "📦 Latest version: $VERSION"

# Construct download URL
ASSET_NAME="${TOOL_NAME}-${VERSION}-${RUNTIME}.tar.gz"
DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/$ASSET_NAME"

echo "⬇️  Downloading $ASSET_NAME..."

# Create temporary directory
TEMP_DIR=$(mktemp -d)
cd "$TEMP_DIR"

# Download the release
if ! curl -L -o "$ASSET_NAME" "$DOWNLOAD_URL"; then
    echo "❌ Failed to download $DOWNLOAD_URL"
    echo "💡 Make sure the release exists and contains the asset: $ASSET_NAME"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Extract the archive
echo "📂 Extracting archive..."
tar -xzf "$ASSET_NAME"

# Create install directory if it doesn't exist
if [ ! -d "$INSTALL_DIR" ]; then
    echo "📁 Creating install directory: $INSTALL_DIR"
    mkdir -p "$INSTALL_DIR"
fi

# Install the binary
echo "📥 Installing $TOOL_NAME to $INSTALL_DIR..."
cp "$TOOL_NAME" "$INSTALL_DIR/"
chmod +x "$INSTALL_DIR/$TOOL_NAME"

# Cleanup
cd - > /dev/null
rm -rf "$TEMP_DIR"

echo "✅ $TOOL_NAME $VERSION installed successfully!"
echo ""
echo "📝 Note: Make sure $INSTALL_DIR is in your PATH."
echo "   Add this line to your ~/.bashrc or ~/.zshrc:"
echo "   export PATH=\"$INSTALL_DIR:\$PATH\""
echo ""
echo "🚀 Example usage:"
echo "   git add ."
echo "   $TOOL_NAME"
echo "   $TOOL_NAME --dry-run"
echo "   $TOOL_NAME --verbose"

# Check if binary is in PATH
if command -v "$TOOL_NAME" >/dev/null 2>&1; then
    echo ""
    echo "🎉 $TOOL_NAME is ready to use!"
else
    echo ""
    echo "⚠️  $TOOL_NAME is not in your PATH. Restart your shell or run:"
    echo "   export PATH=\"$INSTALL_DIR:\$PATH\""
fi
