# WriteCommit

A cross-platform tool that generates AI-powered commit messages using OpenAI, Azure OpenAI, or GitHub Copilot.

## ✨ Features

- 🤖 **AI-powered commit messages** - Generate meaningful commit messages from your staged changes
- 🔄 **Cross-platform** - Works on Windows, macOS, and Linux
- 🎛️ **Highly configurable** - Adjust AI parameters to your preference
- 🧪 **Dry-run mode** - Preview generated messages without committing
- 📝 **Verbose output** - Detailed logging for debugging and transparency
- ⚡ **Fast and lightweight** - Direct OpenAI, Azure OpenAI, or GitHub Copilot integration
- 📋 **Smart chunking** - Handles large diffs by intelligently splitting them into semantic chunks
- 🔍 **Context-aware** - Adds surrounding code lines when diffs are very small for better summaries
- 🎨 **VSCode Extension** - Seamless integration with Visual Studio Code
- 💡 **GitHub Copilot Support** - Use your existing Copilot subscription without additional API keys

## 🚀 Quick Start

### Prerequisites

- [Node.js 18.0 or later](https://nodejs.org/)
- Git repository with staged changes
- **Optional:** OpenAI/Azure OpenAI API key (not required if using GitHub Copilot in VSCode)

### Installation

#### CLI Usage

**Via npx (recommended):**
```bash
npx write-commit
```

**Global installation:**
```bash
npm install -g write-commit
```

#### VSCode Extension

1. Open VSCode
2. Go to Extensions (Ctrl+Shift+X / Cmd+Shift+X)
3. Search for "WriteCommit"
4. Click Install

Or install from `.vsix` file:
```bash
code --install-extension write-commit-1.0.0.vsix
```

### Basic Usage

#### CLI

```bash
# Stage your changes
git add .

# Generate and commit with AI-powered message
write-commit
```

#### VSCode Extension

1. Stage your changes in the Source Control view
2. Click the WriteCommit button in the Source Control toolbar
3. Or use Command Palette: `WriteCommit: Generate Commit Message`
4. The generated message will appear in the commit message box
5. Review and commit!

## 🎯 Advanced Usage

### CLI Options

```bash
# Preview message without committing
write-commit --dry-run

# Detailed output for debugging
write-commit --verbose

# Custom AI parameters
write-commit --temperature 0.7 --topp 0.9

# Specify provider (openai, azure, or vscode-lm)
write-commit --provider openai

# Combine multiple options
write-commit --dry-run --verbose --temperature 0.5
```

## ⚙️ Configuration Options

### CLI Configuration

| Option | Default | Description |
|--------|---------|-------------|
| `--dry-run` | `false` | Generate message without committing |
| `--verbose` | `false` | Show detailed output |
| `--temperature` | `1` | AI creativity level (0-2) |
| `--topp` | `1` | Nucleus sampling parameter (0-1) |
| `--model` | `gpt-4o-mini` | OpenAI model to use |
| `--provider` | `openai` | AI provider: openai, azure, or vscode-lm |
| `--presence` | `0` | Presence penalty (-2 to 2) |
| `--frequency` | `0` | Frequency penalty (-2 to 2) |
| `--setup` | `false` | Configure OpenAI or Azure OpenAI settings |

### VSCode Extension Settings

Access via `File > Preferences > Settings > Extensions > WriteCommit`:

- **Provider**: Choose between OpenAI, Azure OpenAI, or VSCode LM (GitHub Copilot)
- **OpenAI API Key**: Your OpenAI API key
- **Azure Endpoint**: Azure OpenAI endpoint URL
- **Default Model**: Model or deployment name
- **Temperature**: AI creativity level (0-2)
- **Top P**: Nucleus sampling parameter (0-1)
- **Verbose**: Show detailed output in logs

## 🔧 How It Works

1. **Validates environment** - Checks for git repository and AI provider availability
2. **Analyzes changes** - Processes your staged git diff using semantic chunking
3. **Generates message** - Uses your configured AI provider to create meaningful commit message
4. **Commits changes** - Applies the generated message (unless `--dry-run`)

## 🔑 Configuration

### Setting up AI Providers

#### Option 1: GitHub Copilot (VSCode Extension Only)

**No API key required!** If you have GitHub Copilot enabled in VSCode:

1. Open VSCode Settings
2. Search for "WriteCommit"
3. Set Provider to `vscode-lm`
4. That's it! WriteCommit will use your Copilot subscription

#### Option 2: OpenAI

**Using the Setup Command:**
```bash
write-commit --setup
```

**Using Environment Variables:**
```bash
# Linux/macOS
export OPENAI_API_KEY="your-api-key-here"

# Windows (PowerShell)
$env:OPENAI_API_KEY="your-api-key-here"
```

**VSCode Extension:**
1. Open VSCode Settings
2. Search for "WriteCommit"
3. Enter your OpenAI API key
4. Set Provider to `openai`

#### Option 3: Azure OpenAI

**Using the Setup Command:**
```bash
write-commit --setup
```
Then select Azure OpenAI and provide your endpoint.

**VSCode Extension:**
1. Open VSCode Settings
2. Search for "WriteCommit"
3. Enter your Azure endpoint
4. Enter your API key
5. Set Provider to `azure`

> **Note:** Environment variables take precedence over configuration files for the CLI.

## 🛠️ Development

### Build from Source

```bash
# Clone the repository
git clone https://github.com/PatrickRuddiman/WriteCommit
cd WriteCommit

# Install dependencies
npm install

# Build the project
npm run build

# For CLI development
npm run build:cli

# For extension development
npm run build:extension

# Watch mode
npm run watch
```

### Project Structure

```
WriteCommit/
├── src/
│   ├── cli/              # CLI entry point
│   ├── extension/        # VSCode extension entry point
│   ├── core/            # Core business logic
│   │   ├── services/    # AI services, Git, Config, etc.
│   │   ├── models/      # TypeScript interfaces
│   │   └── constants/   # Constants and defaults
│   └── shared/          # Shared logic between CLI and extension
├── patterns/            # AI prompt templates
├── dist/               # Compiled JavaScript
└── package.json        # Dependencies and scripts
```

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆕 What's New in TypeScript Version

- ✅ Full TypeScript rewrite for better type safety
- ✅ VSCode extension with native integration
- ✅ GitHub Copilot support via VSCode Language Model API
- ✅ Improved error handling and user experience
- ✅ Unified codebase for CLI and extension
- ✅ Better documentation and maintainability

---

**Made with ❤️ for developers who want better commit messages**
