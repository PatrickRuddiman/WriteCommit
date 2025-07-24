# WriteCommit VS Code Extension

This extension integrates the **WriteCommit** CLI with Visual Studio Code.
It adds an action in the Source Control panel that generates a commit message
using the WriteCommit tool and inserts it into the commit message input box.

## Features
- Single click commit message generation with OpenAI
- Automatically installs the WriteCommit CLI if not present
- Uses the `--dry-run` option so nothing is committed automatically
- Configurable OpenAI key and executable path
- Shows a spinner in the Source Control panel while generating the message

## Configuration
- `writecommit.openAIApiKey` – API key used for generation
- `writecommit.executablePath` – Path to the WriteCommit executable

## Installation
When the command is first run, the extension checks for the `WriteCommit`
executable. If it is not found, it will download and install it using the
official installation script for your platform.


## Publishing
The extension can be published to the Visual Studio Code Marketplace using the
`vsce` tool. A GitHub Actions workflow is provided in
`.github/workflows/publish-extension.yml` that runs `vsce publish` whenever a tag
matching `extension-v*` is pushed. Set the `VSCE_TOKEN` secret in your
repository with a Personal Access Token that has the `Marketplace` scope.
