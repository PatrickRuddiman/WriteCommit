using System;
using System.IO;
using System.Threading.Tasks;

namespace WriteCommit.Services;

public class PatternInstaller
{
    private static readonly string FabricPatternsDir = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
        ".config",
        "fabric",
        "patterns"
    );

    public static async Task EnsurePatternInstalledAsync(string patternName, bool verbose = false)
    {
        var sourcePatternDir = GetSourcePatternDirectory(patternName);
        var targetPatternDir = Path.Combine(FabricPatternsDir, patternName);

        if (!Directory.Exists(sourcePatternDir))
        {
            throw new DirectoryNotFoundException(
                $"Source pattern directory not found: {sourcePatternDir}"
            );
        }

        // Always install the pattern regardless of whether it exists or is up to date
        if (Directory.Exists(targetPatternDir))
        {
            if (verbose)
            {
                Console.WriteLine($"Pattern '{patternName}' exists. Reinstalling...");
            }
        }
        else
        {
            if (verbose)
            {
                Console.WriteLine($"Installing pattern '{patternName}'...");
            }
        }

        // Create fabric patterns directory if it doesn't exist
        Directory.CreateDirectory(FabricPatternsDir);

        // Copy the pattern
        await CopyPatternAsync(sourcePatternDir, targetPatternDir, verbose);

        if (verbose)
        {
            Console.WriteLine(
                $"Pattern '{patternName}' installed successfully to: {targetPatternDir}"
            );
        }
    }

    private static string GetSourcePatternDirectory(string patternName)
    {
        // Get the directory where the executable is located
        var executableDir = AppDomain.CurrentDomain.BaseDirectory;
        // Look for patterns directory relative to executable
        var patternsDir = Path.Combine(executableDir, "patterns", patternName);

        if (Directory.Exists(patternsDir))
        {
            return patternsDir;
        }

        // Fallback: look in the project directory (for development)
        var projectDir = Path.GetDirectoryName(
            System.Reflection.Assembly.GetExecutingAssembly().Location
        );

        while (projectDir != null && !File.Exists(Path.Combine(projectDir, "WriteCommit.csproj")))
        {
            projectDir = Path.GetDirectoryName(projectDir);
        }

        if (projectDir != null)
        {
            var devPatternsDir = Path.Combine(projectDir, "patterns", patternName);
            if (Directory.Exists(devPatternsDir))
            {
                return devPatternsDir;
            }
        }

        throw new DirectoryNotFoundException(
            $"Could not find pattern '{patternName}' in any expected location."
        );
    }

    private static async Task<bool> IsPatternUpToDateAsync(string sourceDir, string targetDir)
    {
        try
        {
            var sourceFiles = Directory.GetFiles(sourceDir, "*", SearchOption.AllDirectories);
            var targetFiles = Directory.GetFiles(targetDir, "*", SearchOption.AllDirectories);

            // Quick check: different number of files means not up to date
            if (sourceFiles.Length != targetFiles.Length)
            {
                return false;
            }

            // Check if all source files exist in target and have same content
            foreach (var sourceFile in sourceFiles)
            {
                var relativePath = Path.GetRelativePath(sourceDir, sourceFile);
                var targetFile = Path.Combine(targetDir, relativePath);

                if (!File.Exists(targetFile))
                {
                    return false;
                }

                // Compare file content
                var sourceContent = await File.ReadAllTextAsync(sourceFile);
                var targetContent = await File.ReadAllTextAsync(targetFile);

                if (sourceContent != targetContent)
                {
                    return false;
                }
            }

            return true;
        }
        catch
        {
            // If any error occurs during comparison, assume not up to date
            return false;
        }
    }

    private static async Task CopyPatternAsync(string sourceDir, string targetDir, bool verbose)
    {
        try
        {
            if (verbose)
            {
                Console.WriteLine($"Starting pattern installation from {sourceDir} to {targetDir}");
            }

            // Remove existing target directory if it exists
            if (Directory.Exists(targetDir))
            {
                if (verbose)
                {
                    Console.WriteLine($"Removing existing pattern directory: {targetDir}");
                }
                Directory.Delete(targetDir, true);
            }

            // Create target directory
            Directory.CreateDirectory(targetDir);

            if (verbose)
            {
                Console.WriteLine($"Copying pattern files and directories...");
            }

            // Copy all files and subdirectories
            await CopyDirectoryRecursiveAsync(sourceDir, targetDir, verbose);

            if (verbose)
            {
                Console.WriteLine($"Pattern installation completed: {sourceDir} → {targetDir}");
            }
        }
        catch (Exception ex)
        {
            throw new InvalidOperationException(
                $"Failed to copy pattern from {sourceDir} to {targetDir}: {ex.Message}",
                ex
            );
        }
    }

    private static async Task CopyDirectoryRecursiveAsync(
        string sourceDir,
        string targetDir,
        bool verbose = false
    )
    {
        // Create target directory
        Directory.CreateDirectory(targetDir);

        // Copy all files
        foreach (var file in Directory.GetFiles(sourceDir))
        {
            var targetFile = Path.Combine(targetDir, Path.GetFileName(file));
            File.Copy(file, targetFile, true);

            if (verbose)
            {
                Console.WriteLine($"  Copied file: {Path.GetFileName(file)}");
            }
        }

        // Copy all subdirectories
        foreach (var directory in Directory.GetDirectories(sourceDir))
        {
            var dirName = Path.GetFileName(directory);
            var targetSubDir = Path.Combine(targetDir, dirName);

            if (verbose)
            {
                Console.WriteLine($"  Processing directory: {dirName}");
            }

            await CopyDirectoryRecursiveAsync(directory, targetSubDir, verbose);
        }
    }

    public static string GetFabricPatternsDirectory()
    {
        return FabricPatternsDir;
    }

    public static bool IsFabricConfigured()
    {
        var fabricConfigDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
            ".config",
            "fabric"
        );

        return Directory.Exists(fabricConfigDir);
    }
}
