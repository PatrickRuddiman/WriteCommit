# WriteCommit

A cross-platform TypeScript tool that generates AI-powered commit messages using OpenAI or Azure OpenAI.

## ✨ Features

- 🤖 **AI-powered commit messages** - Generate meaningful commit messages from your staged changes
- 🔄 **Cross-platform** - Works on Windows, macOS, and Linux with Node.js
- 🎛️ **Highly configurable** - Adjust AI parameters to your preference
- 🧪 **Dry-run mode** - Preview generated messages without committing
- 📝 **Verbose output** - Detailed logging for debugging and transparency
- ⚡ **Fast and lightweight** - Direct OpenAI or Azure OpenAI integration for quick responses
- 📋 **Smart chunking** - Handles large diffs by intelligently splitting them into semantic chunks
- 🔍 **Context-aware** - Adds surrounding code lines when diffs are very small for better summaries

## 🚀 Quick Start

### Prerequisites

- [Node.js 18.0 or later](https://nodejs.org/)
- OpenAI or Azure OpenAI API key (optional, required only if your endpoint needs authentication)
- Git repository with staged changes

### Installation

**Install globally from npm:**
```bash
npm install -g write-commit
```

**Or use with npx (no installation required):**
```bash
npx write-commit
```

### Basic Usage

```bash
# Stage your changes
git add .

# Generate and commit with AI-powered message
write-commit
```

## 🎯 Advanced Usage

```bash
# Preview message without committing
write-commit --dry-run

# Detailed output for debugging
write-commit --verbose

# Custom AI parameters
write-commit --temperature 0.7 --topp 0.9

# Combine multiple options
write-commit --dry-run --verbose --temperature 0.5
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
write-commit --setup
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
git clone https://github.com/PatrickRuddiman/WriteCommit
cd WriteCommit
npm install
npm run build
npm start -- --help
```

### Development Commands
```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode
npm run dev

# Clean build artifacts
npm run clean

# Run tests
npm test
```

### Contributing
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📦 Publishing

This package is published to npm as `write-commit`. To publish a new version:

```bash
# Update version in package.json
npm version patch # or minor, major

# Build and publish
npm run build
npm publish
```

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

**Made with ❤️ for developers who want better commit messages**