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
            () => FabricPatterns.CommitPattern,
            "Fabric pattern to use"
        );
        var temperatureOption = new Option<int>(
            "--temperature",
            () => 1,
            "Temperature setting for fabric (0-2)"
        );
        var topPOption = new Option<int>("--topp", () => 1, "Top-p setting for fabric (0-1)");
        var presenceOption = new Option<int>("--presence", () => 0, "Presence penalty for fabric");
        var frequencyOption = new Option<int>(
            "--frequency",
            () => 0,
            "Frequency penalty for fabric"
        );
        var modelOption = new Option<string>(
            "--model",
            () => "gpt-4o-mini",
            "AI model to use (default: gpt-4o-mini)"
        );
        var reinstallPatternsOption = new Option<bool>(
            "--reinstall-patterns",
            "Force reinstallation of all patterns"
        );

        var rootCommand = new RootCommand("Generate AI-powered commit messages using fabric")
        {
            dryRunOption,
            verboseOption,
            patternOption,
            temperatureOption,
            topPOption,
            presenceOption,
            frequencyOption,
            modelOption,
            reinstallPatternsOption,
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
                    // Check if patterns should be reinstalled
                    bool reinstallPatterns = args.Contains("--reinstall-patterns");

                    // Ensure patterns are installed before proceeding
                    var patternService = new PatternService(verbose);
                    await patternService.EnsurePatternsInstalledAsync(reinstallPatterns);

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
        var fabricService = new FabricService();

        // Ensure the pattern is installed in fabric patterns directory
        try
        {
            await PatternInstaller.EnsurePatternInstalledAsync(pattern, verbose);
        }
        catch (Exception ex)
        {
            if (verbose)
            {
                Console.WriteLine($"Warning: Could not install pattern '{pattern}': {ex.Message}");
                Console.WriteLine(
                    "Proceeding with assumption that pattern is already available in fabric..."
                );
            }
            // Continue anyway - the pattern might already be available in fabric
        }

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

        // Generate commit message using fabric with chunking support
        var commitMessage = await fabricService.GenerateCommitMessageAsync(
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
                "Failed to generate commit message. Please check that fabric is installed and accessible."
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
}
