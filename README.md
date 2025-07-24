# WriteCommit

A cross-platform .NET tool that generates AI-powered commit messages using OpenAI or Azure OpenAI.

## ✨ Features

- 🤖 **AI-powered commit messages** - Generate meaningful commit messages from your staged changes
- 🔄 **Cross-platform** - Works on Windows, macOS, and Linux
- 🎛️ **Highly configurable** - Adjust AI parameters to your preference
- 🧪 **Dry-run mode** - Preview generated messages without committing
- 📝 **Verbose output** - Detailed logging for debugging and transparency
- ⚡ **Fast and lightweight** - Direct OpenAI or Azure OpenAI integration for quick responses
- 📋 **Smart chunking** - Handles large diffs by intelligently splitting them into semantic chunks
- 🔍 **Context-aware** - Adds surrounding code lines when diffs are very small for better summaries

## 🚀 Quick Start

### Prerequisites

- [.NET 8.0 or later](https://dotnet.microsoft.com/download)
- OpenAI or Azure OpenAI API key (optional, required only if your endpoint needs authentication)
- Git repository with staged changes

### Installation

**Quick install (latest release):**
```bash
# Auto-detect platform (Linux/macOS)
curl -sSL https://raw.githubusercontent.com/PatrickRuddiman/WriteCommit/refs/heads/main/install-universal.sh | bash

# Specific architecture (Linux/macOS)
curl -sSL https://raw.githubusercontent.com/PatrickRuddiman/WriteCommit/refs/heads/main/install-universal.sh | bash -s -- --arch linux-arm64

# Windows - One-liner install (PowerShell)
iex (irm https://raw.githubusercontent.com/PatrickRuddiman/WriteCommit/refs/heads/main/install-web.ps1)
```

**Supported architectures:**
- `linux-x64` - Linux 64-bit (Intel/AMD)
- `linux-arm64` - Linux ARM64 (Apple Silicon, Raspberry Pi, etc.)
- `osx-x64` - macOS Intel
- `osx-arm64` - macOS Apple Silicon
- `win-x64` - Windows 64-bit

**Build from source:**
```bash
# Windows
.\install.ps1

# Linux/macOS  
chmod +x install.sh && ./install.sh
```

**Manual installation:**
```bash
git clone https://github.com/yourusername/WriteCommit.git
cd WriteCommit

# Publish for your platform
dotnet publish --configuration Release --runtime win-x64 --self-contained true --output publish/win-x64  # Windows
dotnet publish --configuration Release --runtime linux-x64 --self-contained true --output publish/linux-x64  # Linux
dotnet publish --configuration Release --runtime osx-x64 --self-contained true --output publish/osx-x64  # macOS

# Copy to your local bin directory and add to PATH
```

### Basic Usage

```bash
# Stage your changes
git add .

# Generate and commit with AI-powered message
WriteCommit
```

## 🎯 Advanced Usage

```bash
# Preview message without committing
WriteCommit --dry-run

# Detailed output for debugging
WriteCommit --verbose

# Custom AI parameters
WriteCommit --temperature 0.7 --topp 0.9

# Combine multiple options
WriteCommit --dry-run --verbose --temperature 0.5
```

## ⚙️ Configuration Options

| Option | Default | Description |
|--------|---------|-------------|
| `--dry-run` | `false` | Generate message without committing |
| `--verbose` | `false` | Show detailed output |
| `--temperature` | `1` | AI creativity level (0-2) |
| `--topp` | `1` | Nucleus sampling parameter (0-1) |
| `--model` | from setup | OpenAI model to use |
| `--presence` | `0` | Presence penalty (-2 to 2) |
| `--frequency` | `0` | Frequency penalty (-2 to 2) |
| `--setup` | `false` | Configure OpenAI or Azure OpenAI settings |

## 🔧 How It Works

1. **Validates environment** - Checks for git repository and OpenAI settings
2. **Analyzes changes** - Processes your staged git diff using semantic chunking
3. **Generates message** - Uses OpenAI or Azure OpenAI to create meaningful commit message
4. **Commits changes** - Applies the generated message (unless `--dry-run`)

## 🔑 Configuration

### Setting up OpenAI API Key

**Option 1: Using the Setup Command (Recommended)**

```bash
# Run the setup wizard
WriteCommit --setup
```

This will prompt you to enter your API key (if needed), choose between OpenAI or Azure OpenAI, specify the endpoint, and default model/deployment. If you select Azure but leave the endpoint blank, WriteCommit will fall back to the standard OpenAI endpoint. The values are saved to `~/.writecommit/config.json`.

**Option 2: Using Environment Variables**

```bash
# Linux/macOS
export OPENAI_API_KEY="your-api-key-here"  # optional

# Windows (PowerShell)
$env:OPENAI_API_KEY="your-api-key-here"  # optional

# Windows (Command Prompt)
set OPENAI_API_KEY=your-api-key-here  # optional
```

For persistent configuration, add the export to your shell profile (`~/.bashrc`, `~/.zshrc`, etc.) or Windows environment variables.

> Note: The environment variable takes precedence over the configuration file if both are set.

## 🛠️ Development

### Run from Source
```bash
git clone https://github.com/PatrickRuddiman/Toolkit
cd Tools/Write-Commit
dotnet build
dotnet run -- --help
```

## VS Code Extension

The `vscode-extension` folder contains an extension that lets you run WriteCommit
directly from VS Code. To try it out:

1. Open the `vscode-extension` folder in VS Code.
2. Run `npm install` and then `npm run build` to compile the extension.
3. Press `F5` to launch an Extension Development Host.

The extension adds a Source Control panel action that runs `WriteCommit --dry-run`
and inserts the generated message into the commit input box. It installs the
CLI automatically if missing and supports configuring the OpenAI API key and
executable path via settings.

### Publishing
The workflow `.github/workflows/publish-extension.yml` uses `vsce publish` to
upload the extension to the Visual Studio Code Marketplace when a tag matching
`extension-v*` is pushed. Before triggering the workflow, add a `VSCE_TOKEN`
secret to your repository with a Marketplace personal access token.

### Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for developers who want better commit messages**
