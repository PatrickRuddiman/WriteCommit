using System.Diagnostics;
using System.Text;
using WriteCommit.Constants;
using WriteCommit.Models;

namespace WriteCommit.Services;

public class FabricService
{
    public async Task<string> GenerateCommitMessageAsync(
        List<DiffChunk> chunks,
        string pattern,
        int temperature,
        int topP,
        int presence,
        int frequency,
        string model,
        bool verbose
    )
    {
        if (chunks.Count == 1)
        {
            // Single chunk - process normally
            return await ProcessSingleChunkAsync(
                chunks[0],
                pattern,
                temperature,
                topP,
                presence,
                frequency,
                model,
                verbose
            );
        }
        else
        {
            // Multiple chunks - process individually and combine
            var commitMessages = new List<string>();
            if (verbose)
            {
                Console.WriteLine($"Processing {chunks.Count} chunks in parallel...");
            }

            // Create tasks for parallel processing
            var chunkTasks = chunks
                .Select(
                    async (chunk, index) =>
                    {
                        if (verbose)
                        {
                            Console.WriteLine(
                                $"Processing chunk {index + 1}/{chunks.Count}: {chunk.FileName}"
                            );
                        }

                        var chunkMessage = await ProcessSingleChunkAsync(
                            chunk,
                            FabricPatterns.ChunkPattern,
                            temperature,
                            topP,
                            presence,
                            frequency,
                            model,
                            verbose
                        );

                        return new
                        {
                            Index = index,
                            FileName = chunk.FileName,
                            Message = chunkMessage,
                        };
                    }
                )
                .ToArray();

            // Wait for all tasks to complete
            var results = await Task.WhenAll(chunkTasks);

            // Process results in order
            foreach (var result in results.OrderBy(r => r.Index))
            {
                if (!string.IsNullOrWhiteSpace(result.Message))
                {
                    commitMessages.Add(
                        $"Chunk {result.Index + 1} ({result.FileName}): {result.Message.Trim()}"
                    );
                }
            }

            // Combine all chunk messages into a coherent commit message
            if (commitMessages.Count == 0)
            {
                throw new InvalidOperationException(
                    "Failed to generate commit message from any chunk"
                );
            }

            // For multiple chunks, create a summary message
            var combinedMessage = await CombineChunkMessagesAsync(
                commitMessages,
                pattern,
                temperature,
                topP,
                presence,
                frequency,
                model,
                verbose
            );
            return combinedMessage;
        }
    }

    private async Task<string> ProcessSingleChunkAsync(
        DiffChunk chunk,
        string pattern,
        int temperature,
        int topP,
        int presence,
        int frequency,
        string model,
        bool verbose
    )
    {
        var platform = DetectPlatform();
        string escapedQuotedContent = EscapeStringForCommandLine(chunk.Content, platform);

        string fabricArgs =
            $"-t {temperature} -T {topP} -P {presence} -F {frequency} -m {model} -p {pattern} {escapedQuotedContent}";

        if (verbose)
        {
            Console.WriteLine($"Running: fabric {fabricArgs}");
        }

        var result = await RunCommandAsync("fabric", fabricArgs, verbose);

        if (result.ExitCode != 0)
        {
            throw new InvalidOperationException($"Fabric command failed: {result.Error}");
        }

        return result.Output.Trim();
    }

    private async Task<string> CombineChunkMessagesAsync(
        List<string> chunkMessages,
        string pattern,
        int temperature,
        int topP,
        int presence,
        int frequency,
        string model,
        bool verbose
    )
    {
        // Create a summary prompt for combining multiple chunk messages
        var platform = DetectPlatform();
        string escapedQuotedContent = EscapeStringForCommandLine(
            string.Join("\n\n", chunkMessages),
            platform
        );

        string fabricArgs =
            $"-t {temperature} -T {topP} -P {presence} -F {frequency} -m {model} -p {pattern} {escapedQuotedContent}";

        if (verbose)
        {
            Console.WriteLine("Combining chunk messages into final commit message...");
            Console.WriteLine($"Running: fabric {fabricArgs}");
        }

        var result = await RunCommandAsync("fabric", fabricArgs, verbose);

        if (result.ExitCode != 0)
        {
            // If combining fails, return the first chunk message as fallback
            if (verbose)
            {
                Console.WriteLine("Failed to combine messages, using first chunk as fallback");
            }
            return chunkMessages[0].Split(':').Skip(1).FirstOrDefault()?.Trim() ?? chunkMessages[0];
        }

        return result.Output.Trim();
    }

    /// <summary>
    /// Escapes a string for safe use in command line arguments
    /// </summary>
    /// <param name="input">The input string to escape</param>
    /// <param name="platform">The platform to escape for (Windows, Linux, or macOS)</param>
    /// <returns>A properly escaped string safe for command line usage</returns>
    private string EscapeStringForCommandLine(
        string input,
        PlatformTarget platform = PlatformTarget.Windows
    )
    {
        if (string.IsNullOrEmpty(input))
        {
            return string.Empty;
        }

        switch (platform)
        {
            case PlatformTarget.Linux:
            case PlatformTarget.MacOS:
                return EscapeForUnixShell(input);
            case PlatformTarget.Windows:
            default:
                return EscapeForWindowsCommandLine(input);
        }
    }

    /// <summary>
    /// Escapes a string for use in Windows command line
    /// </summary>
    private string EscapeForWindowsCommandLine(string input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return string.Empty;
        }

        // For Windows, we need to handle CMD.EXE escaping rules
        var result = input
            // Escape backslashes that precede quotes
            .Replace("\\", "\\\\")
            // Escape quotes
            .Replace("\"", "\\\"")
            // Escape special characters
            .Replace("&", "^&")
            .Replace("|", "^|")
            .Replace("<", "^<")
            .Replace(">", "^>")
            .Replace("^", "^^")
            // Handle newlines for command line (replace with spaces)
            .Replace("\r\n", " ")
            .Replace("\n", " ")
            .Replace("\r", " ")
            // Handle other problematic characters
            .Replace("%", "^%")
            .Replace("!", "^!");

        return $"\"{result}\"";
    }

    /// <summary>
    /// Escapes a string for use in Unix-like shells (Linux and macOS)
    /// </summary>
    private string EscapeForUnixShell(string input)
    {
        if (string.IsNullOrEmpty(input))
        {
            return string.Empty;
        }

        // For Unix shells, single quotes are the safest way to escape content
        // but we need to handle single quotes within the string

        // Replace single quotes with '\'' (close quote, escaped quote, open quote)
        var escaped = input.Replace("'", "'\\''");

        // Wrap the whole thing in single quotes
        return $"'{escaped}'";
    }

    /// <summary>
    /// Target platform for command line escaping
    /// </summary>
    public enum PlatformTarget
    {
        Windows,
        Linux,
        MacOS,
    }

    // Detect the current platform automatically
    private PlatformTarget DetectPlatform()
    {
        if (OperatingSystem.IsWindows())
            return PlatformTarget.Windows;
        else if (OperatingSystem.IsMacOS())
            return PlatformTarget.MacOS;
        else
            return PlatformTarget.Linux; // Default to Linux for other Unix-like systems
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
