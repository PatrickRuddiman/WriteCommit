import * as vscode from 'vscode';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

interface VsCodeLmConfig {
    endpoint?: string;
    model?: string;
    apiKey?: string;
}

async function isExecutableAvailable(cmd: string): Promise<boolean> {
    const check = process.platform === 'win32' ? 'where' : 'which';
    try {
        await execFileAsync(check, [cmd]);
        return true;
    } catch {
        return false;
    }
}

async function installWriteCommit(options: { silent?: boolean } = {}) {
    const { silent } = options;
    const script = process.platform === 'win32'
        ? ['-Command', 'iwr https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-web.ps1 -UseBasicParsing | iex']
        : ['-c', 'curl -sSL https://raw.githubusercontent.com/PatrickRuddiman/Toolkit/main/Tools/Write-Commit/install-universal.sh | bash'];

    const shell = process.platform === 'win32' ? 'powershell' : 'bash';
    try {
        if (!silent) {
            vscode.window.showInformationMessage('Installing WriteCommit CLI...');
        }
        await execFileAsync(shell, script);
        if (!silent) {
            vscode.window.showInformationMessage('WriteCommit CLI installed successfully.');
        }
    } catch (err: any) {
        const message = err?.message ?? String(err);
        if (!silent) {
            vscode.window.showErrorMessage(`Failed to install WriteCommit: ${message}`);
        } else {
            console.error('Failed to install WriteCommit silently', message);
        }
        throw err;
    }
}

function applyConfig(target: VsCodeLmConfig, addition: VsCodeLmConfig): void {
    if (!addition) {
        return;
    }

    if (!target.endpoint && addition.endpoint) {
        target.endpoint = addition.endpoint;
    }
    if (!target.model && addition.model) {
        target.model = addition.model;
    }
    if (!target.apiKey && addition.apiKey) {
        target.apiKey = addition.apiKey;
    }
}

function extractFromCandidate(candidate: unknown): VsCodeLmConfig {
    if (!candidate || typeof candidate !== 'object') {
        return {};
    }

    const obj = candidate as Record<string, unknown>;
    const config: VsCodeLmConfig = {};

    const endpointKeys = ['endpoint', 'url', 'baseUrl', 'baseURL', 'host'];
    for (const key of endpointKeys) {
        const value = obj[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            config.endpoint = value.trim();
            break;
        }
    }

    const apiKeyKeys = ['apiKey', 'key', 'token', 'accessToken', 'authToken'];
    for (const key of apiKeyKeys) {
        const value = obj[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            config.apiKey = value.trim();
            break;
        }
    }

    const modelKeys = ['model', 'defaultModel', 'preferredModel', 'modelId'];
    for (const key of modelKeys) {
        const value = obj[key];
        if (typeof value === 'string' && value.trim().length > 0) {
            config.model = value.trim();
            break;
        }
    }

    if (!config.model) {
        const models = obj['models'];
        if (typeof models === 'string' && models.trim().length > 0) {
            config.model = models.trim();
        } else if (Array.isArray(models)) {
            const firstString = models.find((item) => typeof item === 'string' && item.trim().length > 0) as string | undefined;
            if (firstString) {
                config.model = firstString.trim();
            }
        } else if (models && typeof models === 'object') {
            const nested = models as Record<string, unknown>;
            const defaultKey = nested['default'] ?? nested['primary'];
            if (typeof defaultKey === 'string' && defaultKey.trim().length > 0) {
                config.model = defaultKey.trim();
            } else if (defaultKey && typeof defaultKey === 'object') {
                const nestedConfig = extractFromCandidate(defaultKey);
                config.model = config.model ?? nestedConfig.model;
            }
        }
    }

    return config;
}

function getVsCodeLmConfiguration(): VsCodeLmConfig {
    const lmConfig = vscode.workspace.getConfiguration('vscode-lm');
    const result: VsCodeLmConfig = {};

    const candidateKeys = [
        lmConfig.get<string>('defaultEndpoint'),
        lmConfig.get<string>('defaultProvider'),
        lmConfig.get<string>('activeEndpoint'),
        lmConfig.get<string>('activeProvider'),
    ].filter((key): key is string => typeof key === 'string' && key.trim().length > 0);

    const endpointCollections = [
        lmConfig.get<Record<string, unknown>>('endpoints'),
        lmConfig.get<Record<string, unknown>>('providers'),
    ];

    for (const collection of endpointCollections) {
        if (!collection || typeof collection !== 'object') {
            continue;
        }

        const entries = Object.entries(collection);
        const preferredEntry = entries.find(([key]) => candidateKeys.includes(key));
        const [, preferredValue] = preferredEntry ?? entries[0] ?? [];

        if (preferredValue) {
            applyConfig(result, extractFromCandidate(preferredValue));
        }
    }

    const directCandidates = [
        lmConfig.get<unknown>('endpoint'),
        lmConfig.get<unknown>('provider'),
        lmConfig.get<unknown>('configuration'),
    ];

    for (const candidate of directCandidates) {
        applyConfig(result, extractFromCandidate(candidate));
    }

    const fallbackStrings: Array<[key: keyof VsCodeLmConfig, value: string | undefined]> = [
        ['endpoint', lmConfig.get<string>('url')],
        ['endpoint', lmConfig.get<string>('endpoint')],
        ['model', lmConfig.get<string>('model')],
        ['model', lmConfig.get<string>('defaultModel')],
        ['apiKey', lmConfig.get<string>('apiKey')],
        ['apiKey', lmConfig.get<string>('token')],
    ];

    for (const [key, value] of fallbackStrings) {
        if (value && value.trim().length > 0) {
            (result as Record<string, string>)[key] = (result as Record<string, string>)[key] ?? value.trim();
        }
    }

    return result;
}

async function ensureWriteCommitInstalled(context: vscode.ExtensionContext) {
    const config = vscode.workspace.getConfiguration('writecommit');
    const executable = config.get<string>('executablePath', 'WriteCommit');
    if (await isExecutableAvailable(executable)) {
        await context.globalState.update('writecommit.cliInstalled', true);
        return;
    }

    try {
        await installWriteCommit({ silent: true });
        await context.globalState.update('writecommit.cliInstalled', true);
    } catch {
        // Installation errors are surfaced via console but should not block activation.
    }
}

async function runWriteCommit(): Promise<string> {
    const config = vscode.workspace.getConfiguration('writecommit');
    const executable = config.get<string>('executablePath', 'WriteCommit');
    const extensionApiKey = config.get<string>('openAIApiKey', '');
    const extensionEndpoint = config.get<string>('openAIEndpoint', '');
    const extensionModel = config.get<string>('model', '');

    const vscodeLmConfig = getVsCodeLmConfiguration();
    const resolvedApiKey = extensionApiKey || vscodeLmConfig.apiKey || '';
    const resolvedEndpoint = extensionEndpoint || vscodeLmConfig.endpoint || '';
    const resolvedModel = extensionModel || vscodeLmConfig.model || '';

    if (!(await isExecutableAvailable(executable))) {
        await installWriteCommit();
    }

    const env = { ...process.env };
    if (resolvedApiKey) {
        env['OPENAI_API_KEY'] = resolvedApiKey;
    }
    if (resolvedEndpoint) {
        env['OPENAI_ENDPOINT'] = resolvedEndpoint;
    }

    try {
        const args = ['--dry-run'];
        if (resolvedModel) {
            args.push('--model', resolvedModel);
        }
        const { stdout } = await execFileAsync(executable, args, { env });
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

    await ensureWriteCommitInstalled(context);

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
