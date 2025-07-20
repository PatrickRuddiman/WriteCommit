using System.Diagnostics;
using System.Text;

namespace WriteCommit.Services;

public class GitService
{
    public async Task<bool> IsInGitRepositoryAsync()
    {
        try
        {
            var result = await RunCommandAsync("git", "rev-parse --git-dir", false);
            return result.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }

    public async Task<string> GetStagedChangesAsync(bool verbose = false)
    {
        var result = await RunCommandAsync("git", "--no-pager diff --staged", verbose);
        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException($"Failed to get staged changes: {result.Error}");
        }
        return result.Output;
    }

    public async Task<string> GetStagedChangesWithContextAsync(
        int contextLines,
        bool verbose = false
    )
    {
        var args = $"--no-pager diff --staged --unified={contextLines}";
        var result = await RunCommandAsync("git", args, verbose);
        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException(
                $"Failed to get staged changes with context: {result.Error}"
            );
        }
        return result.Output;
    }

    public async Task CommitChangesAsync(string commitMessage, bool verbose)
    {
        // Create temporary file for commit message
        var tempFile = Path.GetTempFileName();
        try
        {
            await File.WriteAllTextAsync(tempFile, commitMessage, Encoding.UTF8);

            // Commit using git
            await RunGitCommandAsync($"commit -F \"{tempFile}\"", verbose);
            Console.WriteLine("Changes committed successfully!");
        }
        finally
        {
            // Clean up temporary file
            if (File.Exists(tempFile))
            {
                File.Delete(tempFile);
            }
        }
    }

    private async Task RunGitCommandAsync(string arguments, bool verbose)
    {
        var result = await RunCommandAsync("git", arguments, verbose);
        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException($"Git command failed: {result.Error}");
        }
    }

    private async Task<(int ExitCode, string Output, string Error)> RunCommandAsync(
        string command,
        string arguments,
        bool verbose
    )
    {
        if (verbose)
        {
            Console.WriteLine($"Running: {command} {arguments}");
        }

        var processStartInfo = new ProcessStartInfo
        {
            FileName = command,
            Arguments = arguments,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true,
        };

        // Set encoding to UTF-8
        processStartInfo.StandardOutputEncoding = Encoding.UTF8;
        processStartInfo.StandardErrorEncoding = Encoding.UTF8;

        using var process = new Process { StartInfo = processStartInfo };

        var outputBuilder = new StringBuilder();
        var errorBuilder = new StringBuilder();

        process.OutputDataReceived += (_, e) =>
        {
            if (e.Data != null)
            {
                outputBuilder.AppendLine(e.Data);
            }
        };

        process.ErrorDataReceived += (_, e) =>
        {
            if (e.Data != null)
            {
                errorBuilder.AppendLine(e.Data);
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        process.BeginErrorReadLine();

        await process.WaitForExitAsync();

        return (process.ExitCode, outputBuilder.ToString(), errorBuilder.ToString());
    }
}
