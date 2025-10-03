import * as vscode from 'vscode';
import { VSCodeLMService } from '../core/services/VSCodeLMService';
import {
  GitService,
  PatternService,
  SemanticAnalyzer,
  ConfigurationService,
  OpenAIService
} from '../core/services';
import { DiffContextDefaults, PatternNames } from '../core/constants';

export function activate(context: vscode.ExtensionContext) {
  console.log('WriteCommit extension is now active');

  const disposable = vscode.commands.registerCommand(
    'write-commit.generateCommitMessage',
    async () => {
      try {
        const config = vscode.workspace.getConfiguration('writeCommit');
        const provider = config.get<string>('provider') || 'vscode-lm';
        const verbose = config.get<boolean>('verbose') || false;
        const temperature = config.get<number>('temperature') || 1;
        const topP = config.get<number>('topP') || 1;
        const model = config.get<string>('defaultModel') || 'gpt-4o-mini';

        // Show progress notification
        await vscode.window.withProgress(
          {
            location: vscode.ProgressLocation.Notification,
            title: 'Generating commit message...',
            cancellable: false
          },
          async (progress) => {
            try {
              progress.report({ increment: 10, message: 'Analyzing staged changes...' });

              // Initialize services
              const gitService = new GitService();
              const patternService = new PatternService();
              const configService = new ConfigurationService();

              // Check git repository
              const isGitRepo = await gitService.isInGitRepositoryAsync();
              if (!isGitRepo) {
                throw new Error('Not in a git repository');
              }

              // Get staged changes
              let stagedChanges = await gitService.getStagedChangesAsync(verbose);
              
              const fileCount = (stagedChanges.match(/^diff --git/gm) || []).length;
              const lineCount = stagedChanges.split('\n').length;

              if (
                fileCount <= DiffContextDefaults.SmallDiffFileThreshold &&
                lineCount < DiffContextDefaults.SmallDiffLineThreshold
              ) {
                stagedChanges = await gitService.getStagedChangesWithContextAsync(
                  DiffContextDefaults.ExtraContextLines,
                  verbose
                );
              }

              if (!stagedChanges || stagedChanges.trim().length === 0) {
                throw new Error('No staged changes found. Please stage your changes first.');
              }

              progress.report({ increment: 30, message: 'Processing changes...' });

              // Chunk the diff
              const analyzer = new SemanticAnalyzer(verbose);
              const chunks = analyzer.chunkDiff(stagedChanges);

              progress.report({ increment: 20, message: 'Generating commit message...' });

              let commitMessage: string;

              if (provider === 'vscode-lm') {
                // Use VSCode Language Model (Copilot)
                const vscodeLMService = new VSCodeLMService(verbose);
                commitMessage = await vscodeLMService.generateCommitMessageAsync(
                  chunks,
                  PatternNames.CommitPattern,
                  patternService
                );
              } else {
                // Use OpenAI
                const apiKey = await configService.getOpenAiApiKeyAsync();
                if (!apiKey) {
                  throw new Error('OpenAI API key not configured');
                }

                const baseURL = await configService.getOpenAiEndpointAsync();

                const openAiService = new OpenAIService(apiKey, baseURL || undefined);
                commitMessage = await openAiService.generateCommitMessageAsync(
                  chunks,
                  PatternNames.CommitPattern,
                  temperature,
                  topP,
                  0,
                  0,
                  model,
                  verbose,
                  patternService
                );
              }

              progress.report({ increment: 40, message: 'Commit message generated!' });

              // Get the Git extension API
              const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;
              if (!gitExtension) {
                throw new Error('Git extension not found');
              }

              const git = gitExtension.getAPI(1);
              if (!git || git.repositories.length === 0) {
                throw new Error('No Git repository found');
              }

              const repository = git.repositories[0];

              // Set the commit message in the Source Control input box
              repository.inputBox.value = commitMessage;

              vscode.window.showInformationMessage(
                'Commit message generated and added to Source Control!'
              );
            } catch (error: any) {
              if (error.message.includes('No Copilot models available')) {
                // Offer to switch provider
                const choice = await vscode.window.showErrorMessage(
                  'GitHub Copilot is not available. Would you like to configure OpenAI instead?',
                  'Configure OpenAI',
                  'Cancel'
                );

                if (choice === 'Configure OpenAI') {
                  await vscode.commands.executeCommand(
                    'workbench.action.openSettings',
                    'writeCommit'
                  );
                }
              } else {
                vscode.window.showErrorMessage(`Error: ${error.message}`);
              }
              throw error;
            }
          }
        );
      } catch (error: any) {
        // Error already handled in progress callback
        console.error('WriteCommit error:', error);
      }
    }
  );

  context.subscriptions.push(disposable);

  // Register a configuration change listener
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('writeCommit')) {
        console.log('WriteCommit configuration changed');
      }
    })
  );
}

export function deactivate() {
  console.log('WriteCommit extension is now deactivated');
}
