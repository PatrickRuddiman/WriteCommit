#!/usr/bin/env node

import { Command } from 'commander';
import {
  GitService,
  ConfigurationService,
  PatternService,
  OpenAIService,
  SemanticCoherenceAnalyzer,
} from './services';
import { DiffContextDefaults, PatternNames } from './constants';

const program = new Command();

async function generateCommitMessage(
  dryRun: boolean,
  verbose: boolean,
  temperature: number,
  topP: number,
  presence: number,
  frequency: number,
  model: string | undefined
): Promise<void> {
  // Initialize services
  const gitService = new GitService();
  const configService = new ConfigurationService();

  // Check if we're in a git repository
  const isInRepo = await gitService.isInGitRepository();
  if (!isInRepo) {
    throw new Error('Not in a git repository. Please run this command from within a git repository.');
  }

  // Get OpenAI configuration
  const apiKey = await configService.getOpenAiApiKey();
  const useAzure = await configService.useAzureOpenAI();
  const endpoint = await configService.getOpenAiEndpoint();
  const defaultModel = await configService.getDefaultModel();

  // Use provided model or fall back to config/default
  const finalModel = model || defaultModel || 'gpt-4o-mini';

  if (verbose) {
    console.log(`Using model: ${finalModel}`);
    console.log(`Using Azure OpenAI: ${useAzure}`);
    console.log(`Endpoint: ${endpoint || 'default'}`);
  }

  // Get staged changes
  const stagedChanges = await gitService.getStagedChanges(verbose);

  if (!stagedChanges.trim()) {
    throw new Error('No staged changes found. Please stage your changes with "git add" first.');
  }

  if (verbose) {
    console.log('Staged changes found, analyzing...');
  }

  // Determine if we need extra context for small diffs
  const lines = stagedChanges.split('\n');
  const isSmallDiff = lines.length <= DiffContextDefaults.SMALL_DIFF_LINE_THRESHOLD;

  let finalDiff = stagedChanges;
  if (isSmallDiff) {
    if (verbose) {
      console.log('Small diff detected, fetching additional context...');
    }
    try {
      finalDiff = await gitService.getStagedChangesWithContext(
        DiffContextDefaults.EXTRA_CONTEXT_LINES,
        verbose
      );
    } catch {
      // If context fetch fails, use original diff
      finalDiff = stagedChanges;
    }
  }

  // Analyze and chunk the diff
  const analyzer = new SemanticCoherenceAnalyzer();
  const chunks = analyzer.chunkDiff(finalDiff, verbose);

  if (verbose) {
    console.log(`Processed diff into ${chunks.length} chunk(s)`);
  }

  // Generate commit message using OpenAI
  const openaiService = new OpenAIService(apiKey || '', endpoint || undefined, useAzure);
  const commitMessage = await openaiService.generateCommitMessage(
    chunks,
    PatternNames.COMMIT_PATTERN,
    temperature,
    topP,
    presence,
    frequency,
    finalModel,
    verbose
  );

  if (!commitMessage.trim()) {
    throw new Error('Failed to generate commit message. Please ensure your OpenAI API key is valid.');
  }

  // Display the generated commit message
  console.log('Generated commit message:');
  console.log(commitMessage);
  console.log();

  if (dryRun) {
    console.log('Dry run mode - not committing changes.');
    return;
  }

  // Commit the changes
  await gitService.commitChanges(commitMessage, verbose);
}

/**
 * Runs the setup process to configure the OpenAI API key
 */
async function runSetup(verbose: boolean): Promise<void> {
  const configService = new ConfigurationService();
  const success = await configService.setupApiKey(verbose);

  if (success) {
    console.log();
    console.log('✅ Setup completed successfully.');
    console.log('You can now use WriteCommit to generate commit messages.');
  } else {
    console.log();
    console.log('❌ Setup failed.');
    console.log('You can try again or set the OPENAI_API_KEY environment variable manually.');
  }
}

async function main(): Promise<void> {
  program
    .name('write-commit')
    .description('Generate AI-powered commit messages using OpenAI or Azure OpenAI')
    .version('1.0.0');

  program
    .option('--dry-run', 'Generate commit message without committing', false)
    .option('--verbose', 'Show detailed output', false)
    .option('--temperature <number>', 'Temperature setting for AI model (0-2)', '1')
    .option('--topp <number>', 'Top-p setting for AI model (0-1)', '1')
    .option('--presence <number>', 'Presence penalty for AI model', '0')
    .option('--frequency <number>', 'Frequency penalty for AI model', '0')
    .option('--model <string>', 'AI model to use (overrides setup)')
    .option('--setup', 'Configure OpenAI or Azure OpenAI settings', false);

  program.action(async (options) => {
    try {
      // Check if setup mode is requested
      if (options.setup) {
        await runSetup(options.verbose);
        return;
      }

      // Ensure patterns are installed before proceeding
      const patternService = new PatternService(options.verbose);
      await patternService.ensurePatternsInstalled();

      await generateCommitMessage(
        options.dryRun,
        options.verbose,
        parseInt(options.temperature),
        parseInt(options.topp),
        parseInt(options.presence),
        parseInt(options.frequency),
        options.model
      );
    } catch (error) {
      console.error(`Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      process.exit(1);
    }
  });

  await program.parseAsync(process.argv);
}

if (require.main === module) {
  main().catch((error) => {
    console.error(`Fatal error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    process.exit(1);
  });
}

export { main };