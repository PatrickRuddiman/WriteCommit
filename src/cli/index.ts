#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigurationService } from '../core/services';
import { CommitGenerator } from '../shared/CommitGenerator';

async function main() {
  const program = new Command();

  program
    .name('write-commit')
    .description('Generate AI-powered commit messages using OpenAI')
    .version('1.0.0');

  program
    .option('--dry-run', 'Generate commit message without committing', false)
    .option('--verbose', 'Show detailed output', false)
    .option('--temperature <number>', 'Temperature setting for AI model (0-2)', '1')
    .option('--topp <number>', 'Top-p setting for AI model (0-1)', '1')
    .option('--presence <number>', 'Presence penalty for AI model (-2 to 2)', '0')
    .option('--frequency <number>', 'Frequency penalty for AI model (-2 to 2)', '0')
  .option('--model <string>', 'AI model to use (overrides setup)')
  .option('--setup', 'Configure OpenAI settings', false)
    .action(async (options) => {
      try {
        // Check if setup mode is requested
        if (options.setup) {
          await runSetup(options.verbose);
          return;
        }

        const generator = new CommitGenerator();
        await generator.generateCommitMessage({
          dryRun: options.dryRun,
          verbose: options.verbose,
          temperature: parseFloat(options.temperature),
          topP: parseFloat(options.topp),
          presence: parseFloat(options.presence),
          frequency: parseFloat(options.frequency),
          model: options.model
        });
      } catch (error: any) {
        console.error(`Error: ${error.message}`);
        process.exit(1);
      }
    });

  await program.parseAsync(process.argv);
}

async function runSetup(verbose: boolean = false): Promise<void> {
  const configService = new ConfigurationService();
  const success = await configService.setupApiKeyAsync(verbose);

  if (success) {
    console.log();
    console.log('✅ Setup completed successfully.');
    console.log('You can now use WriteCommit to generate commit messages.');
  } else {
    console.log();
    console.log('❌ Setup failed.');
    console.log(
      'You can try again or set the OPENAI_API_KEY environment variable manually.'
    );
  }
}

main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
