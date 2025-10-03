import {
  ConfigurationService,
  GitService,
  OpenAIService,
  PatternService,
  SemanticAnalyzer
} from '../core/services';
import { DiffContextDefaults, PatternNames } from '../core/constants';

export interface CommitGeneratorOptions {
  dryRun?: boolean;
  verbose?: boolean;
  temperature?: number;
  topP?: number;
  presence?: number;
  frequency?: number;
  model?: string;
  provider?: 'openai' | 'azure' | 'vscode-lm';
}

export class CommitGenerator {
  private gitService: GitService;
  private configService: ConfigurationService;
  private patternService: PatternService;

  constructor() {
    this.gitService = new GitService();
    this.configService = new ConfigurationService();
    this.patternService = new PatternService();
  }

  async generateCommitMessage(options: CommitGeneratorOptions = {}): Promise<string> {
    const {
      dryRun = false,
      verbose = false,
      temperature = 1,
      topP = 1,
      presence = 0,
      frequency = 0,
      model,
      provider
    } = options;

    // Ensure patterns are installed
    await this.patternService.ensurePatternsInstalledAsync();

    // Check if we're in a git repository
    const isGitRepo = await this.gitService.isInGitRepositoryAsync();
    if (!isGitRepo) {
      throw new Error(
        'Not in a git repository. Please run this command from within a git repository.'
      );
    }

    // Get staged changes
    let stagedChanges = await this.gitService.getStagedChangesAsync(verbose);

    // If the diff is very small, grab extra context
    const fileCount = (stagedChanges.match(/^diff --git/gm) || []).length;
    const lineCount = stagedChanges.split('\n').length;

    if (
      fileCount <= DiffContextDefaults.SmallDiffFileThreshold &&
      lineCount < DiffContextDefaults.SmallDiffLineThreshold
    ) {
      if (verbose) {
        console.log('Small diff detected, gathering additional context...');
      }
      stagedChanges = await this.gitService.getStagedChangesWithContextAsync(
        DiffContextDefaults.ExtraContextLines,
        verbose
      );
    }

    if (!stagedChanges || stagedChanges.trim().length === 0) {
      throw new Error(
        "No staged changes found. Please stage your changes first using 'git add'."
      );
    }

    if (verbose) {
      console.log('Staged changes detected. Analyzing and generating commit message...');
    }

    // Initialize semantic analyzer
    const analyzer = new SemanticAnalyzer(verbose);

    // Chunk the diff if it's large
    const chunks = analyzer.chunkDiff(stagedChanges);

    if (chunks.length > 1 && verbose) {
      console.log(
        `Large diff detected. Split into ${chunks.length} semantic chunks for processing.`
      );
    }

    // Get configuration
    const effectiveModel = model || (await this.configService.getDefaultModelAsync()) || 'gpt-4o-mini';

    // Get OpenAI API key
    const apiKey = await this.configService.getOpenAiApiKeyAsync();
    if (!apiKey) {
      throw new Error(
        'OpenAI API key not found. Please run setup or set the OPENAI_API_KEY environment variable.'
      );
    }

    // Get optional custom endpoint
    const baseURL = await this.configService.getOpenAiEndpointAsync();

    // Create OpenAI service
    const openAiService = new OpenAIService(apiKey, baseURL || undefined);
    const commitMessage = await openAiService.generateCommitMessageAsync(
      chunks,
      PatternNames.CommitPattern,
      temperature,
      topP,
      presence,
      frequency,
      effectiveModel,
      verbose,
      this.patternService
    );

    if (!commitMessage || commitMessage.trim().length === 0) {
      throw new Error(
        'Failed to generate commit message. Please ensure your AI provider is configured correctly.'
      );
    }

    // Display the generated commit message
    console.log('Generated commit message:');
    console.log(commitMessage);
    console.log();

    if (dryRun) {
      console.log('Dry run mode - not committing changes.');
      return commitMessage;
    }

    // Commit the changes
    await this.gitService.commitChangesAsync(commitMessage, verbose);

    return commitMessage;
  }
}
