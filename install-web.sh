#!/bin/bash
# Web installer for WriteCommit tool (Linux/macOS)
# Usage: curl -sSL https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-web.sh | bash

set -e

# Configuration
REPO="PatrickRuddiman/Toolkit"
TOOL_NAME="WriteCommit"
INSTALL_DIR="$HOME/.local/share/WriteCommit"
BIN_DIR="$HOME/.local/bin"
VERSION="latest"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --version)
            VERSION="$2"
            shift 2
            ;;
        --install-dir)
            INSTALL_DIR="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            echo "Usage: $0 [--version VERSION] [--install-dir DIR]"
            exit 1
            ;;
    esac
done

# Detect OS
OS=$(uname -s)
ARCH=$(uname -m)

case $OS in
    Linux)
        PLATFORM="linux"
        ;;
    Darwin)
        PLATFORM="macos"
        ;;
    *)
        echo "❌ Unsupported OS: $OS"
        echo "This script is for Linux and macOS only. For Windows, use the PowerShell installer:"
        echo "iex (irm https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-web.ps1)"
        exit 1
        ;;
esac

# Detect architecture
case $ARCH in
    x86_64)
        ARCH_TAG="x64"
        ;;
    aarch64|arm64)
        echo "❌ ARM architecture not yet supported for installation"
        exit 1
        ;;
    *)
        echo "❌ Unsupported architecture: $ARCH"
        exit 1
        ;;
esac

echo "🔍 Installing WriteCommit for $PLATFORM ($ARCH_TAG)..."

# Get version info if latest
if [ "$VERSION" = "latest" ]; then
    echo "📡 Fetching latest release information..."
    LATEST_RELEASE=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")
    VERSION=$(echo "$LATEST_RELEASE" | grep '"tag_name":' | sed -E 's/.*"([^"]+)".*/\1/')

    if [ -z "$VERSION" ]; then
        echo "❌ Failed to get latest release version"
        exit 1
    fi
fi

echo "📦 Version: $VERSION"

# Construct download URL with correct naming pattern
ASSET_NAME="${TOOL_NAME}-${PLATFORM}-${ARCH_TAG}-${VERSION}.tar.gz"
DOWNLOAD_URL="https://github.com/$REPO/releases/download/$VERSION/$ASSET_NAME"

echo "⬇️  Downloading $ASSET_NAME from $DOWNLOAD_URL..."

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

# Remove old installation if exists
if [ -d "$INSTALL_DIR" ]; then
    echo "📦 Removing previous installation..."
    rm -rf "$INSTALL_DIR"
fi

# Create install directory
echo "📁 Creating install directory: $INSTALL_DIR"
mkdir -p "$INSTALL_DIR"

# Extract the entire archive to preserve dependencies
echo "📂 Extracting archive to $INSTALL_DIR..."
tar -xzf "$ASSET_NAME" -C "$INSTALL_DIR"

# Create bin directory if it doesn't exist
if [ ! -d "$BIN_DIR" ]; then
    echo "📁 Creating bin directory: $BIN_DIR"
    mkdir -p "$BIN_DIR"
fi

# Create a wrapper script in the bin directory
echo "📥 Creating wrapper script in $BIN_DIR..."
WRAPPER_PATH="$BIN_DIR/WriteCommit"
cat > "$WRAPPER_PATH" << EOF
#!/bin/bash
exec "$INSTALL_DIR/WriteCommit" "\$@"
EOF
chmod +x "$WRAPPER_PATH"

# Cleanup
cd - > /dev/null
rm -rf "$TEMP_DIR"

# Update PATH in shell configuration
update_shell_config() {
    local config_file="$1"
    local path_entry="export PATH=\"$BIN_DIR:\$PATH\""
    
    if [ -f "$config_file" ]; then
        if ! grep -q "$BIN_DIR" "$config_file"; then
            echo "" >> "$config_file"
            echo "# Added by WriteCommit installer" >> "$config_file"
            echo "$path_entry" >> "$config_file"
            echo "✅ Updated $config_file"
            return 0
        else
            echo "ℹ️ PATH entry already exists in $config_file"
            return 1
        fi
    fi
    return 2
}

echo "📝 Updating shell configuration..."
PATH_UPDATED=false

# Try to update various shell config files
if [ -n "$BASH_VERSION" ] || [ "$SHELL" = "/bin/bash" ]; then
    update_shell_config "$HOME/.bashrc" && PATH_UPDATED=true
    [ -f "$HOME/.bash_profile" ] && update_shell_config "$HOME/.bash_profile"
fi

if [ "$SHELL" = "/bin/zsh" ] || [ "$SHELL" = "/usr/bin/zsh" ]; then
    update_shell_config "$HOME/.zshrc" && PATH_UPDATED=true
fi

# Check for fish shell
if command -v fish >/dev/null 2>&1 || [ "$SHELL" = "/usr/bin/fish" ]; then
    FISH_CONFIG="$HOME/.config/fish/config.fish"
    if [ -f "$FISH_CONFIG" ]; then
        if ! grep -q "$BIN_DIR" "$FISH_CONFIG"; then
            mkdir -p "$(dirname "$FISH_CONFIG")"
            echo "" >> "$FISH_CONFIG"
            echo "# Added by WriteCommit installer" >> "$FISH_CONFIG"
            echo "fish_add_path $BIN_DIR" >> "$FISH_CONFIG"
            echo "✅ Updated $FISH_CONFIG"
            PATH_UPDATED=true
        else
            echo "ℹ️ PATH entry already exists in $FISH_CONFIG"
        fi
    fi
fi

if [ "$PATH_UPDATED" = false ]; then
    echo "⚠️ Could not automatically update shell configuration."
    echo "Please add the following line to your shell configuration file:"
    echo "  export PATH=\"$BIN_DIR:\$PATH\""
fi

echo ""
echo "✅ WriteCommit $VERSION installed successfully!"
echo ""
echo "📂 Installation directory: $INSTALL_DIR"
echo "🚀 Example usage:"
echo "   git add ."
echo "   WriteCommit"
echo "   WriteCommit --dry-run"
echo "   WriteCommit --verbose"

# Check if binary is in PATH
if command -v WriteCommit >/dev/null 2>&1; then
    echo ""
    echo "🎉 WriteCommit is ready to use!"
else
    echo ""
    echo "⚠️ You need to restart your terminal or run the following command to use WriteCommit in this session:"
    echo "   export PATH=\"$BIN_DIR:\$PATH\""
fi
