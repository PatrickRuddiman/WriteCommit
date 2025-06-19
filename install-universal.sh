#!/bin/bash
# Universal web installer for WriteCommit tool
# Usage: curl -sSL https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-universal.sh | bash
# Or with arch override: curl -sSL https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-universal.sh | bash -s -- --arch linux-arm64

set -e

# Configuration
REPO="PatrickRuddiman/Toolkit"
TOOL_NAME="WriteCommit"
INSTALL_DIR="$HOME/.local/bin"

# Parse command line arguments
OVERRIDE_ARCH=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --arch)
            OVERRIDE_ARCH="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--arch RUNTIME]"
            echo "Available architectures: linux-x64, linux-arm64, osx-x64, osx-arm64"
            exit 1
            ;;
    esac
done

# Auto-detect architecture if not overridden
if [ -n "$OVERRIDE_ARCH" ]; then
    RUNTIME="$OVERRIDE_ARCH"
    echo "🔧 Using specified architecture: $RUNTIME"
else
    # Detect architecture
    ARCH=$(uname -m)
    OS=$(uname -s)
    
    case $OS in
        Linux)
            case $ARCH in
                x86_64)
                    RUNTIME="linux-x64"
                    ;;
                aarch64|arm64)
                    RUNTIME="linux-arm64"
                    ;;
                *)
                    echo "❌ Unsupported Linux architecture: $ARCH"
                    echo "💡 Try specifying manually: --arch linux-x64"
                    exit 1
                    ;;
            esac
            ;;
        Darwin)
            case $ARCH in
                x86_64)
                    RUNTIME="osx-x64"
                    ;;
                arm64)
                    RUNTIME="osx-arm64"
                    ;;
                *)
                    echo "❌ Unsupported macOS architecture: $ARCH"
                    echo "💡 Try specifying manually: --arch osx-x64"
                    exit 1
                    ;;
            esac
            ;;
        *)
            echo "❌ Unsupported OS: $OS"
            echo "This script is for Linux and macOS only. For Windows, use:"
            echo "iex (irm https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-web.ps1)"
            exit 1
            ;;
    esac
    
    echo "🔍 Detected platform: $OS ($ARCH) -> $RUNTIME"
fi

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
    echo "💡 Available architectures for $VERSION:"
    echo "   linux-x64, linux-arm64, osx-x64, osx-arm64"
    echo "💡 Try: curl -sSL [script-url] | bash -s -- --arch [ARCH]"
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

echo "✅ $TOOL_NAME $VERSION ($RUNTIME) installed successfully!"
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
