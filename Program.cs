using System.CommandLine;
using Microsoft.Extensions.Logging;
using WriteCommit.Constants;
using WriteCommit.Services;

namespace WriteCommit;

class Program
{
    static async Task<int> Main(string[] args)
    {
        var dryRunOption = new Option<bool>(
            "--dry-run",
            "Generate commit message without committing"
        );
        var verboseOption = new Option<bool>("--verbose", "Show detailed output");
        var patternOption = new Option<string>(
            "--pattern",
            () => PatternNames.CommitPattern,
            "Pattern to use for message generation"
        );
        var temperatureOption = new Option<int>(
            "--temperature",
            () => 1,
            "Temperature setting for AI model (0-2)"
        );
        var topPOption = new Option<int>("--topp", () => 1, "Top-p setting for AI model (0-1)");
        var presenceOption = new Option<int>("--presence", () => 0, "Presence penalty for AI model");
        var frequencyOption = new Option<int>(
            "--frequency",
            () => 0,
            "Frequency penalty for AI model"
        );
        var modelOption = new Option<string>(
            "--model",
            () => "gpt-4o-mini",
            "AI model to use (default: gpt-4o-mini)"
        );

        var setupOption = new Option<bool>(
            "--setup",
            "Configure OpenAI API key"
        );

        var rootCommand = new RootCommand("Generate AI-powered commit messages using OpenAI")
        {
            dryRunOption,
            verboseOption,
            patternOption,
            temperatureOption,
            topPOption,
            presenceOption,
            frequencyOption,
            modelOption,
            setupOption,
        };

        rootCommand.SetHandler(
            async (
                bool dryRun,
                bool verbose,
                string pattern,
                int temperature,
                int topP,
                int presence,
                int frequency,
                string model
            ) =>
            {
                try
                {
                    // Check if setup mode is requested
                    bool setupMode = args.Contains("--setup");
                    if (setupMode)
                    {
                        await RunSetupAsync(verbose);
                        return;
                    }

                    // Ensure patterns are installed before proceeding
                    var patternService = new PatternService(verbose);
                    await patternService.EnsurePatternsInstalledAsync();

                    await GenerateCommitMessage(
                        dryRun,
                        verbose,
                        pattern,
                        temperature,
                        topP,
                        presence,
                        frequency,
                        model
                    );
                }
                catch (Exception ex)
                {
                    Console.Error.WriteLine($"Error: {ex.Message}");
                    Environment.Exit(1);
                }
            },
            dryRunOption,
            verboseOption,
            patternOption,
            temperatureOption,
            topPOption,
            presenceOption,
            frequencyOption,
            modelOption
        );

        return await rootCommand.InvokeAsync(args);
    }

    static async Task GenerateCommitMessage(
        bool dryRun,
        bool verbose,
        string pattern,
        int temperature,
        int topP,
        int presence,
        int frequency,
        string model
    )
    {
        var gitService = new GitService();

        // Get OpenAI API key
        var configService = new ConfigurationService();
        var apiKey = await configService.GetOpenAiApiKeyAsync();

        if (string.IsNullOrEmpty(apiKey))
        {
            throw new InvalidOperationException(
                "OpenAI API key not found. Please run 'WriteCommit --setup' to configure your API key " +
                "or set the OPENAI_API_KEY environment variable."
            );
        }

        // Create OpenAI service with the API key
        var openAiService = new OpenAIService(apiKey);

        // Check if we're in a git repository
        if (!Directory.Exists(".git") && !await gitService.IsInGitRepositoryAsync())
        {
            throw new InvalidOperationException(
                "Not in a git repository. Please run this command from within a git repository."
            );
        }

        // Get staged changes
        var stagedChanges = await gitService.GetStagedChangesAsync();
        if (string.IsNullOrWhiteSpace(stagedChanges))
        {
            Console.WriteLine(
                "No staged changes found. Please stage your changes first using 'git add'."
            );
            return;
        }

        if (verbose)
        {
            Console.WriteLine(
                "Staged changes detected. Analyzing and generating commit message..."
            );
        }

        // Initialize semantic analyzer
        using var loggerFactory = LoggerFactory.Create(builder =>
            builder.AddConsole().SetMinimumLevel(verbose ? LogLevel.Information : LogLevel.Warning)
        );
        var logger = loggerFactory.CreateLogger<SemanticCoherenceAnalyzer>();
        var analyzer = new SemanticCoherenceAnalyzer(logger);

        // Chunk the diff if it's large
        var chunks = analyzer.ChunkDiff(stagedChanges, verbose);

        if (chunks.Count > 1 && verbose)
        {
            Console.WriteLine(
                $"Large diff detected. Split into {chunks.Count} semantic chunks for processing."
            );
        }

        // Generate commit message using OpenAI with chunking support
        var commitMessage = await openAiService.GenerateCommitMessageAsync(
            chunks,
            pattern,
            temperature,
            topP,
            presence,
            frequency,
            model,
            verbose
        );

        if (string.IsNullOrWhiteSpace(commitMessage))
        {
            throw new InvalidOperationException(
                "Failed to generate commit message. Please ensure your OpenAI API key is valid."
            );
        }

        // Display the generated commit message
        Console.WriteLine("Generated commit message:");
        Console.WriteLine(commitMessage);
        Console.WriteLine();

        if (dryRun)
        {
            Console.WriteLine("Dry run mode - not committing changes.");
            return;
        }

        // Commit the changes
        await gitService.CommitChangesAsync(commitMessage, verbose);
    }

    /// <summary>
    /// Runs the setup process to configure the OpenAI API key
    /// </summary>
    static async Task RunSetupAsync(bool verbose)
    {
        var configService = new ConfigurationService();
        bool success = await configService.SetupApiKeyAsync(verbose);

        if (success)
        {
            Console.WriteLine();
            Console.WriteLine("✅ Setup completed successfully.");
            Console.WriteLine("You can now use WriteCommit to generate commit messages.");
        }
        else
        {
            Console.WriteLine();
            Console.WriteLine("❌ Setup failed.");
            Console.WriteLine("You can try again or set the OPENAI_API_KEY environment variable manually.");
        }
    }
}
