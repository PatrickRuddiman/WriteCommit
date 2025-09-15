# WriteCommit VS Code Extension

This extension integrates the **WriteCommit** CLI with Visual Studio Code.
It adds an action in the Source Control panel that generates a commit message
using the WriteCommit tool and inserts it into the commit message input box.

## Features
- Single click commit message generation with OpenAI
- Automatically installs the WriteCommit CLI when the extension is first activated
- Reuses the Language Model (`vscode-lm`) endpoint and model configured in VS Code (including GitHub Copilot)
- Uses the `--dry-run` option so nothing is committed automatically
- Configurable OpenAI key, endpoint, model, and executable path for manual overrides
- Shows a spinner in the Source Control panel while generating the message

## Configuration
- `writecommit.openAIApiKey` – API key used for generation
- `writecommit.openAIEndpoint` – Custom API endpoint (optional)
- `writecommit.model` – Model name to use
- `writecommit.executablePath` – Path to the WriteCommit executable

## Installation
As soon as the extension activates (after VS Code finishes starting), it checks
for the `WriteCommit` executable. If it is missing, the extension downloads and
installs it using the official installation script for your platform so the CLI
is ready before you run the command.

If you have configured an endpoint or model through the `vscode-lm` extension,
the WriteCommit command will automatically reuse those settings. You can still
override them with the `writecommit.*` settings if you need to target a
different model.


## Publishing
The extension can be published to the Visual Studio Code Marketplace using the
`vsce` tool. A GitHub Actions workflow is provided in
`.github/workflows/publish-extension.yml` that runs `vsce publish` whenever a tag
matching `extension-v*` is pushed. Set the `VSCE_TOKEN` secret in your
repository with a Personal Access Token that has the `Marketplace` scope.
