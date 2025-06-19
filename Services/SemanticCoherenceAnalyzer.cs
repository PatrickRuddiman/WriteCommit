using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;
using WriteCommit.Models;

namespace WriteCommit.Services;

public class SemanticCoherenceAnalyzer
{
    private readonly ILogger<SemanticCoherenceAnalyzer>? _logger;
    private const int MaxTokensPerChunk = 3000; // Conservative estimate for LLM context
    private const int TargetChunkSize = 2500;

    public SemanticCoherenceAnalyzer(ILogger<SemanticCoherenceAnalyzer>? logger = null)
    {
        _logger = logger;
    }

    public List<DiffChunk> ChunkDiff(string gitDiff, bool verbose = false)
    {
        if (verbose)
        {
            _logger?.LogInformation("Starting semantic coherence analysis of git diff...");
        }

        var chunks = new List<DiffChunk>();
        var lines = gitDiff.Split('\n', StringSplitOptions.RemoveEmptyEntries);

        if (EstimateTokenCount(gitDiff) <= MaxTokensPerChunk)
        {
            if (verbose)
            {
                _logger?.LogInformation("Diff is small enough, no chunking needed");
            }

            chunks.Add(
                new DiffChunk
                {
                    FileName = "all_changes",
                    Content = gitDiff,
                    LineCount = lines.Length,
                    ChangeType = "Mixed",
                }
            );
            return chunks;
        }

        if (verbose)
        {
            _logger?.LogInformation("Large diff detected, applying semantic chunking...");
        }

        var currentChunk = new StringBuilder();
        var currentFileName = string.Empty;
        var fileChanges = new Dictionary<string, StringBuilder>();

        foreach (var line in lines)
        {
            // Detect file boundaries
            if (line.StartsWith("diff --git"))
            {
                // Save previous chunk if it exists
                if (currentChunk.Length > 0 && !string.IsNullOrEmpty(currentFileName))
                {
                    if (!fileChanges.ContainsKey(currentFileName))
                    {
                        fileChanges[currentFileName] = new StringBuilder();
                    }
                    fileChanges[currentFileName].AppendLine(currentChunk.ToString());
                }

                // Extract file name
                var match = Regex.Match(line, @"diff --git a/(.*?) b/(.*)");
                if (match.Success)
                {
                    currentFileName = match.Groups[2].Value;
                }

                currentChunk.Clear();
            }

            currentChunk.AppendLine(line);
        }

        // Add the last chunk
        if (currentChunk.Length > 0 && !string.IsNullOrEmpty(currentFileName))
        {
            if (!fileChanges.ContainsKey(currentFileName))
            {
                fileChanges[currentFileName] = new StringBuilder();
            }
            fileChanges[currentFileName].AppendLine(currentChunk.ToString());
        }

        // Group files by semantic similarity and size constraints
        chunks = GroupFilesBySemanticCoherence(fileChanges, verbose);

        if (verbose)
        {
            _logger?.LogInformation($"Created {chunks.Count} semantic chunks");
        }

        return chunks;
    }

    private List<DiffChunk> GroupFilesBySemanticCoherence(
        Dictionary<string, StringBuilder> fileChanges,
        bool verbose
    )
    {
        var chunks = new List<DiffChunk>();
        var processedFiles = new HashSet<string>();

        foreach (var kvp in fileChanges)
        {
            if (processedFiles.Contains(kvp.Key))
                continue;

            var fileName = kvp.Key;
            var content = kvp.Value.ToString();
            var estimatedTokens = EstimateTokenCount(content);

            if (estimatedTokens <= TargetChunkSize)
            {
                // Try to group with similar files
                var chunk = CreateChunkWithSimilarFiles(
                    fileName,
                    fileChanges,
                    processedFiles,
                    verbose
                );
                chunks.Add(chunk);
            }
            else
            {
                // File is too large, split it further
                var subChunks = SplitLargeFile(fileName, content, verbose);
                chunks.AddRange(subChunks);
                processedFiles.Add(fileName);
            }
        }

        return chunks;
    }

    private DiffChunk CreateChunkWithSimilarFiles(
        string primaryFile,
        Dictionary<string, StringBuilder> fileChanges,
        HashSet<string> processedFiles,
        bool verbose
    )
    {
        var chunkContent = new StringBuilder();
        var chunkFiles = new List<string> { primaryFile };
        var totalTokens = EstimateTokenCount(fileChanges[primaryFile].ToString());

        chunkContent.Append(fileChanges[primaryFile].ToString());
        processedFiles.Add(primaryFile);

        // Look for semantically similar files that can fit in the same chunk
        foreach (var kvp in fileChanges)
        {
            if (processedFiles.Contains(kvp.Key))
                continue;

            var fileName = kvp.Key;
            var content = kvp.Value.ToString();
            var fileTokens = EstimateTokenCount(content);

            // Check if files are semantically related and fit within token limits
            if (
                totalTokens + fileTokens <= TargetChunkSize
                && AreFilesSemanticallySimilar(primaryFile, fileName)
            )
            {
                chunkContent.AppendLine();
                chunkContent.Append(content);
                chunkFiles.Add(fileName);
                totalTokens += fileTokens;
                processedFiles.Add(fileName);

                if (verbose)
                {
                    Console.WriteLine(
                        $"Grouped {fileName} with {primaryFile} (semantic similarity)"
                    );
                }
            }
        }

        return new DiffChunk
        {
            FileName =
                chunkFiles.Count == 1
                    ? primaryFile
                    : $"{chunkFiles.Count}_files_({string.Join(", ", chunkFiles.Take(3))}{(chunkFiles.Count > 3 ? "..." : "")})",
            Content = chunkContent.ToString(),
            LineCount = chunkContent.ToString().Split('\n').Length,
            ChangeType = DetermineChangeType(chunkContent.ToString()),
        };
    }

    private List<DiffChunk> SplitLargeFile(string fileName, string content, bool verbose)
    {
        var chunks = new List<DiffChunk>();
        var lines = content.Split('\n');
        var currentChunk = new StringBuilder();
        var chunkIndex = 1;
        var currentTokens = 0;

        if (verbose)
        {
            Console.WriteLine($"Splitting large file {fileName} into smaller chunks...");
        }

        foreach (var line in lines)
        {
            var lineTokens = EstimateTokenCount(line);

            if (currentTokens + lineTokens > TargetChunkSize && currentChunk.Length > 0)
            {
                // Create chunk
                chunks.Add(
                    new DiffChunk
                    {
                        FileName = $"{fileName}_chunk_{chunkIndex}",
                        Content = currentChunk.ToString(),
                        LineCount = currentChunk.ToString().Split('\n').Length,
                        ChangeType = DetermineChangeType(currentChunk.ToString()),
                    }
                );

                currentChunk.Clear();
                currentTokens = 0;
                chunkIndex++;
            }

            currentChunk.AppendLine(line);
            currentTokens += lineTokens;
        }

        // Add remaining content
        if (currentChunk.Length > 0)
        {
            chunks.Add(
                new DiffChunk
                {
                    FileName = chunks.Count > 0 ? $"{fileName}_chunk_{chunkIndex}" : fileName,
                    Content = currentChunk.ToString(),
                    LineCount = currentChunk.ToString().Split('\n').Length,
                    ChangeType = DetermineChangeType(currentChunk.ToString()),
                }
            );
        }

        return chunks;
    }

    private bool AreFilesSemanticallySimilar(string file1, string file2)
    {
        // Simple semantic similarity based on file extensions and path structure
        var ext1 = Path.GetExtension(file1).ToLowerInvariant();
        var ext2 = Path.GetExtension(file2).ToLowerInvariant();

        // Same extension
        if (ext1 == ext2)
            return true;

        // Related file types
        var webFiles = new[] { ".html", ".css", ".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte" };
        var codeFiles = new[]
        {
            ".cs",
            ".vb",
            ".fs",
            ".cpp",
            ".h",
            ".c",
            ".java",
            ".py",
            ".rb",
            ".go",
            ".rs",
        };
        var configFiles = new[] { ".json", ".xml", ".yaml", ".yml", ".toml", ".ini", ".config" };
        var docFiles = new[] { ".md", ".txt", ".rst", ".adoc" };

        return (webFiles.Contains(ext1) && webFiles.Contains(ext2))
            || (codeFiles.Contains(ext1) && codeFiles.Contains(ext2))
            || (configFiles.Contains(ext1) && configFiles.Contains(ext2))
            || (docFiles.Contains(ext1) && docFiles.Contains(ext2))
            || (Path.GetDirectoryName(file1) == Path.GetDirectoryName(file2)); // Same directory
    }

    private string DetermineChangeType(string content)
    {
        var hasAdditions = content.Contains("\n+") || content.Contains("new file mode");
        var hasDeletions = content.Contains("\n-") || content.Contains("deleted file mode");
        var hasRenames = content.Contains("rename from") || content.Contains("rename to");

        if (hasRenames)
            return "Renamed";
        if (hasAdditions && hasDeletions)
            return "Modified";
        if (hasAdditions)
            return "Added";
        if (hasDeletions)
            return "Deleted";
        return "Modified";
    }

    private int EstimateTokenCount(string text)
    {
        // Rough estimation: ~4 characters per token for code
        // This is conservative to ensure we don't exceed LLM limits
        return Math.Max(1, text.Length / 4);
    }
}
