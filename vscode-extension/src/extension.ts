import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

async function isExecutableAvailable(cmd: string): Promise<boolean> {
    const check = process.platform === 'win32' ? 'where' : 'which';
    try {
        await execFileAsync(check, [cmd]);
        return true;
    } catch {
        return false;
    }
}

async function installWriteCommit() {
    const script = process.platform === 'win32'
        ? ['-Command', 'iwr https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-web.ps1 -UseBasicParsing | iex']
        : ['-c', 'curl -sSL https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-universal.sh | bash'];

    const shell = process.platform === 'win32' ? 'powershell' : 'bash';
    vscode.window.showInformationMessage('Installing WriteCommit CLI...');
    try {
        await execFileAsync(shell, script);
    } catch (err: any) {
        vscode.window.showErrorMessage(`Failed to install WriteCommit: ${err.message}`);
        throw err;
    }
}

async function runWriteCommit(): Promise<string> {
    const config = vscode.workspace.getConfiguration('writecommit');
    const executable = config.get<string>('executablePath', 'WriteCommit');
    const apiKey = config.get<string>('openAIApiKey', '');

    if (!(await isExecutableAvailable(executable))) {
        await installWriteCommit();
    }

    const env = { ...process.env };
    if (apiKey) {
        env['OPENAI_API_KEY'] = apiKey;
    }

    try {
        const { stdout } = await execFileAsync(executable, ['--dry-run'], { env });
        const output = stdout.trim();
        const match = output.match(/Generated commit message:\s*([\s\S]*?)(?:\n\s*Dry run mode|$)/);
        return match ? match[1].trim() : output;
    } catch (err: any) {
        vscode.window.showErrorMessage(`WriteCommit failed: ${err.message}`);
        throw err;
    }
}

export async function activate(context: vscode.ExtensionContext) {
    const gitExt = vscode.extensions.getExtension('vscode.git');
    await gitExt?.activate();
    const gitApi = gitExt?.exports.getAPI(1);

    const disposable = vscode.commands.registerCommand('writecommit.generateMessage', async () => {
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.SourceControl,
            title: 'Generating commit message...'
        }, async () => {
            const message = await runWriteCommit();
            if (!gitApi) {
                vscode.window.showErrorMessage('Git extension not available');
                return;
            }
            const repo = gitApi.repositories[0];
            if (!repo) {
                vscode.window.showErrorMessage('No git repository found');
                return;
            }
            repo.inputBox.value = message;
        });
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {}
