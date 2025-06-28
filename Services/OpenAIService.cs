using System.Text;
using OpenAI.Chat;
using WriteCommit.Constants;
using WriteCommit.Models;

namespace WriteCommit.Services;

public class OpenAIService
{
    private readonly string _apiKey;
    private readonly string _patternsDirectory;
    private const int MaxContextTokens = 128000;

    public OpenAIService(string apiKey)
    {
        if (string.IsNullOrEmpty(apiKey))
        {
            throw new ArgumentNullException(nameof(apiKey), "API key cannot be null or empty");
        }

        _apiKey = apiKey;
        _patternsDirectory = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "patterns");
    }

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
                            PatternNames.ChunkPattern,
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
        if (verbose)
        {
            Console.WriteLine($"Processing chunk with OpenAI API using pattern: {pattern}");
        }

        // Load the system prompt from the pattern file
        var systemPrompt = await LoadPatternAsync(pattern);
        if (string.IsNullOrWhiteSpace(systemPrompt))
        {
            throw new InvalidOperationException($"Failed to load pattern: {pattern}");
        }

        // Create a client for this specific model
        var chatClient = new ChatClient(model, _apiKey);

        // Create the chat messages
        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(systemPrompt),
            new UserChatMessage(chunk.Content),
        };

        // Create chat completion options
        var options = new ChatCompletionOptions
        {
            Temperature = ConvertTemperature(temperature),
            TopP = ConvertTopP(topP),
            PresencePenalty = ConvertPenalty(presence),
            FrequencyPenalty = ConvertPenalty(frequency),
        };

        if (verbose)
        {
            Console.WriteLine($"Sending request to OpenAI API with model: {model}");
        }

        try
        {
            // Send request to OpenAI
            var response = await chatClient.CompleteChatAsync(messages, options);

            if (verbose)
            {
                Console.WriteLine("Received response from OpenAI API");
            }

            if (response.Value != null)
            {
                return response.Value.Content[0].Text.Trim();
            }
            else
            {
                throw new InvalidOperationException("No response received from OpenAI API");
            }
        }
        catch (Exception ex)
        {
            if (verbose)
            {
                Console.WriteLine($"Error calling OpenAI API: {ex.Message}");
            }
            throw new InvalidOperationException(
                $"Failed to generate commit message: {ex.Message}",
                ex
            );
        }
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
        if (verbose)
        {
            Console.WriteLine("Combining chunk messages into final commit message...");
        }

        // Load the system prompt from the pattern file
        var systemPrompt = await LoadPatternAsync(pattern);
        if (string.IsNullOrWhiteSpace(systemPrompt))
        {
            throw new InvalidOperationException($"Failed to load pattern: {pattern}");
        }

        var combinedContent = string.Join("\n\n", chunkMessages);
        var estimatedTokens = EstimateTokenCount(systemPrompt) + EstimateTokenCount(combinedContent);

        if (estimatedTokens > MaxContextTokens && chunkMessages.Count > 1)
        {
            if (verbose)
            {
                Console.WriteLine("Context length exceeded, re-chunking summaries...");
            }

            var groupedSummaries = new List<string>();
            var currentGroup = new List<string>();
            var currentTokens = EstimateTokenCount(systemPrompt);

            foreach (var msg in chunkMessages)
            {
                var msgTokens = EstimateTokenCount(msg);
                if (currentTokens + msgTokens > MaxContextTokens / 2 && currentGroup.Count > 0)
                {
                    var summary = await CombineChunkMessagesAsync(currentGroup, pattern, temperature, topP, presence, frequency, model, verbose);
                    groupedSummaries.Add(summary);
                    currentGroup.Clear();
                    currentTokens = EstimateTokenCount(systemPrompt);
                }

                currentGroup.Add(msg);
                currentTokens += msgTokens;
            }

            if (currentGroup.Count > 0)
            {
                var summary = await CombineChunkMessagesAsync(currentGroup, pattern, temperature, topP, presence, frequency, model, verbose);
                groupedSummaries.Add(summary);
            }

            return await CombineChunkMessagesAsync(groupedSummaries, pattern, temperature, topP, presence, frequency, model, verbose);
        }

        // Create a client for this specific model
        var chatClient = new ChatClient(model, _apiKey);

        // Create the chat messages
        var messages = new List<ChatMessage>
        {
            new SystemChatMessage(systemPrompt),
            new UserChatMessage(combinedContent),
        };

        // Create chat completion options
        var options = new ChatCompletionOptions
        {
            Temperature = ConvertTemperature(temperature),
            TopP = ConvertTopP(topP),
            PresencePenalty = ConvertPenalty(presence),
            FrequencyPenalty = ConvertPenalty(frequency),
        };

        try
        {
            // Send request to OpenAI
            var response = await chatClient.CompleteChatAsync(messages, options);

            if (response.Value != null)
            {
                return response.Value.Content[0].Text.Trim();
            }
            else
            {
                throw new InvalidOperationException("No response received from OpenAI API");
            }
        }
        catch (Exception ex)
        {
            // If combining fails, return the first chunk message as fallback
            if (verbose)
            {
                Console.WriteLine($"Error calling OpenAI API: {ex.Message}");
                Console.WriteLine("Failed to combine messages, using first chunk as fallback");
            }
            return chunkMessages[0].Split(':').Skip(1).FirstOrDefault()?.Trim() ?? chunkMessages[0];
        }
    }

    /// <summary>
    /// Loads a pattern file from the patterns directory
    /// </summary>
    private async Task<string> LoadPatternAsync(string patternName)
    {
        var patternPath = Path.Combine(_patternsDirectory, patternName, "system.md");

        if (!File.Exists(patternPath))
        {
            throw new FileNotFoundException($"Pattern file not found: {patternPath}");
        }

        return await File.ReadAllTextAsync(patternPath);
    }

    /// <summary>
    /// Converts the temperature value from the CLI (0-2) to OpenAI API range (0-2)
    /// </summary>
    private float ConvertTemperature(int temperature)
    {
        // OpenAI uses 0-2 for temperature
        return Math.Clamp(Convert.ToSingle(temperature), 0f, 2f);
    }

    /// <summary>
    /// Converts the top-p value from the CLI (0-1) to OpenAI API range (0-1)
    /// </summary>
    private float ConvertTopP(int topP)
    {
        // OpenAI uses 0-1 for top-p
        return Math.Clamp((float)topP, 0f, 1f);
    }

    /// <summary>
    /// Converts the penalty value from the CLI (-2 to 2) to OpenAI API range (-2 to 2)
    /// </summary>
    private float ConvertPenalty(int penalty)
    {
        // OpenAI uses -2 to 2 for penalties
        return Math.Clamp((float)penalty, -2f, 2f);
    }

    /// <summary>
    /// Estimates token count using a rough 4 chars per token heuristic
    /// </summary>
    private int EstimateTokenCount(string text)
    {
        return Math.Max(1, text.Length / 4);
    }
}
