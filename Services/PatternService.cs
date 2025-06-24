namespace WriteCommit.Services;

public class PatternService
{
    private readonly string _patternsDirectory;
    private readonly bool _verbose;

    public PatternService(bool verbose = false)
    {
        _verbose = verbose;
        _patternsDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "patterns");
    }

    /// <summary>
    /// Ensures all patterns are available
    /// </summary>
    public async Task EnsurePatternsInstalledAsync()
    {
        if (!Directory.Exists(_patternsDirectory))
        {
            if (_verbose)
            {
                Console.WriteLine("Patterns directory not found.");
            }
            throw new DirectoryNotFoundException($"Patterns directory not found: {_patternsDirectory}");
        }

        var patternDirectories = Directory.GetDirectories(_patternsDirectory);

        if (_verbose)
        {
            Console.WriteLine($"Found {patternDirectories.Length} patterns available.");
        }

        // Verify each pattern has a system.md file
        foreach (var patternDir in patternDirectories)
        {
            var patternName = Path.GetFileName(patternDir);
            var systemFile = Path.Combine(patternDir, "system.md");

            if (!File.Exists(systemFile))
            {
                throw new FileNotFoundException($"Pattern '{patternName}' is missing system.md file");
            }

            if (_verbose)
            {
                Console.WriteLine($"✓ Pattern '{patternName}' is available");
            }
        }

        await Task.CompletedTask; // Keep async signature for compatibility
    }
}
