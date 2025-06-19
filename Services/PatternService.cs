using System.Security.Cryptography;
using System.Text;

namespace WriteCommit.Services;

public class PatternService
{
    private readonly string _patternsDirectory;
    private readonly string _fabricPatternsPath;
    private readonly bool _verbose;

    public PatternService(bool verbose = false)
    {
        _verbose = verbose;
        _patternsDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "patterns");
        _fabricPatternsPath = GetFabricPatternsPath();
    }

    /// <summary>
    /// Ensures all patterns are installed
    /// </summary>
    public async Task EnsurePatternsInstalledAsync(bool forceReinstall = false)
    {
        if (!Directory.Exists(_patternsDirectory))
        {
            if (_verbose)
            {
                Console.WriteLine("Patterns directory not found, skipping pattern installation.");
            }
            return;
        }
        if (string.IsNullOrEmpty(_fabricPatternsPath))
        {
            if (_verbose)
            {
                Console.WriteLine(
                    "Fabric patterns directory not found. Please ensure fabric is installed."
                );
            }
            return;
        }

        // Ensure fabric patterns directory exists
        Directory.CreateDirectory(_fabricPatternsPath);

        var patternDirectories = Directory.GetDirectories(_patternsDirectory);

        if (_verbose)
        {
            Console.WriteLine($"Found {patternDirectories.Length} patterns to install...");
        }

        foreach (var patternDir in patternDirectories)
        {
            var patternName = Path.GetFileName(patternDir);
            await InstallPatternIfNeededAsync(patternName, patternDir, forceReinstall);
        }
    }

    /// <summary>
    /// Installs or updates a pattern
    /// </summary>
    private async Task InstallPatternIfNeededAsync(
        string patternName,
        string sourcePatternDir,
        bool forceReinstall
    )
    {
        var targetPatternDir = Path.Combine(_fabricPatternsPath, patternName);

        // Always install patterns regardless of whether they've changed
        if (_verbose)
        {
            Console.WriteLine($"Installing pattern: {patternName}");
        }

        await CopyPatternDirectoryAsync(sourcePatternDir, targetPatternDir);

        if (_verbose)
        {
            Console.WriteLine($"Successfully installed pattern: {patternName}");
        }
    }

    /// <summary>
    /// Checks if a pattern has changed by comparing file hashes
    /// </summary>
    private async Task<bool> HasPatternChangedAsync(string sourceDir, string targetDir)
    {
        if (!Directory.Exists(targetDir))
        {
            return true;
        }

        var sourceFiles = Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories);
        var targetFiles = Directory.GetFiles(targetDir, "*", SearchOption.AllDirectories);

        // Check if file count differs
        if (sourceFiles.Length != targetFiles.Length)
        {
            return true;
        }

        // Compare each file's hash
        foreach (var sourceFile in sourceFiles)
        {
            var relativePath = Path.GetRelativePath(sourceDir, sourceFile);
            var targetFile = Path.Combine(targetDir, relativePath);

            if (!File.Exists(targetFile))
            {
                return true;
            }

            var sourceHash = await CalculateFileHashAsync(sourceFile);
            var targetHash = await CalculateFileHashAsync(targetFile);

            if (sourceHash != targetHash)
            {
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Copies pattern directory to fabric patterns directory
    /// </summary>
    private Task CopyPatternDirectoryAsync(string sourceDir, string targetDir)
    {
        return Task.Run(() =>
        {
            try
            {
                // Remove existing directory if it exists
                if (Directory.Exists(targetDir))
                {
                    Directory.Delete(targetDir, true);
                }

                // Create target directory
                Directory.CreateDirectory(targetDir);

                // Copy all files and subdirectories
                var files = Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories);

                foreach (var sourceFile in files)
                {
                    var relativePath = Path.GetRelativePath(sourceDir, sourceFile);
                    var targetFile = Path.Combine(targetDir, relativePath);
                    var targetFileDir = Path.GetDirectoryName(targetFile);

                    if (!string.IsNullOrEmpty(targetFileDir) && !Directory.Exists(targetFileDir))
                    {
                        Directory.CreateDirectory(targetFileDir);
                    }

                    File.Copy(sourceFile, targetFile, true);
                }

                if (_verbose)
                {
                    Console.WriteLine($"Copied pattern to: {targetDir}");
                }
            }
            catch (Exception ex)
            {
                if (_verbose)
                {
                    Console.WriteLine($"Failed to copy pattern: {ex.Message}");
                }
                throw;
            }
        });
    }

    /// <summary>
    /// Calculates SHA256 hash of a file
    /// </summary>
    private static async Task<string> CalculateFileHashAsync(string filePath)
    {
        using var sha256 = SHA256.Create();
        using var stream = File.OpenRead(filePath);
        var hash = await sha256.ComputeHashAsync(stream);
        return Convert.ToHexString(hash);
    }

    /// <summary>
    /// Gets the fabric patterns directory path
    /// </summary>
    private static string GetFabricPatternsPath()
    {
        // Primary location for fabric patterns
        var fabricPatternsPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".config",
            "fabric",
            "patterns"
        );

        return fabricPatternsPath;
    }
}
