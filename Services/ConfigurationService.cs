using System.Text.Json;
using OpenAI.Chat;
using WriteCommit.Constants;
using WriteCommit.Models;

namespace WriteCommit.Services;

public class ConfigurationService
{
    private readonly string _configDirectory;
    private readonly string _configFilePath;

    public ConfigurationService()
    {
        var homeDirectory = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        _configDirectory = Path.Combine(homeDirectory, ".writecommit");
        _configFilePath = Path.Combine(_configDirectory, "config.json");
    }

    /// <summary>
    /// Loads the configuration from file
    /// </summary>
    public async Task<AppConfiguration?> LoadConfigurationAsync()
    {
        if (!File.Exists(_configFilePath))
        {
            return null;
        }

        try
        {
            var json = await File.ReadAllTextAsync(_configFilePath);
            return JsonSerializer.Deserialize<AppConfiguration>(json);
        }
        catch
        {
            // If there's any error reading or parsing the config, return null
            return null;
        }
    }

    /// <summary>
    /// Saves the configuration to file
    /// </summary>
    public async Task SaveConfigurationAsync(AppConfiguration config)
    {
        // Ensure directory exists
        Directory.CreateDirectory(_configDirectory);

        var options = new JsonSerializerOptions { WriteIndented = true };

        var json = JsonSerializer.Serialize(config, options);
        await File.WriteAllTextAsync(_configFilePath, json);

        // Set appropriate file permissions on Unix systems
        if (OperatingSystem.IsLinux() || OperatingSystem.IsMacOS())
        {
            SetUnixFilePermissions(_configFilePath);
        }
    }

    /// <summary>
    /// Gets the OpenAI API key from environment variable or config file
    /// </summary>
    public async Task<string?> GetOpenAiApiKeyAsync()
    {
        // First check environment variable (highest priority)
        var envApiKey = Environment.GetEnvironmentVariable("OPENAI_API_KEY");
        if (!string.IsNullOrEmpty(envApiKey))
        {
            return envApiKey;
        }

        // Then check config file
        var config = await LoadConfigurationAsync();
        return config?.OpenAiApiKey;
    }

    /// <summary>
    /// Prompts user to enter and save their OpenAI API key
    /// </summary>
    public async Task<bool> SetupApiKeyAsync(bool verbose = false)
    {
        Console.WriteLine("WriteCommit Setup");
        Console.WriteLine("=================");
        Console.WriteLine();
        Console.WriteLine("Please enter your OpenAI API key.");
        Console.WriteLine("You can get one from: https://platform.openai.com/api-keys");
        Console.WriteLine();
        Console.Write("API Key: ");

        // Read API key with masked input
        var apiKey = ReadMaskedInput();
        Console.WriteLine();

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            Console.WriteLine("No API key entered. Setup cancelled.");
            return false;
        }

        // Basic validation
        if (!apiKey.StartsWith("sk-"))
        {
            Console.WriteLine("Invalid API key format. OpenAI API keys should start with 'sk-'.");
            return false;
        }

        // Load existing config or create new one
        var config = await LoadConfigurationAsync() ?? new AppConfiguration();
        config.OpenAiApiKey = apiKey;

        // Save configuration
        await SaveConfigurationAsync(config);

        Console.WriteLine($"✅ API key saved to {_configFilePath}");

        if (verbose)
        {
            Console.WriteLine("Configuration saved successfully.");
            Console.WriteLine($"Config location: {_configFilePath}");
        }

        // Optionally test the API key
        Console.WriteLine();
        Console.Write("Would you like to test the API key? (y/N): ");
        var testResponse = Console.ReadLine()?.Trim().ToLowerInvariant();

        if (testResponse == "y" || testResponse == "yes")
        {
            return await TestApiKeyAsync(apiKey, verbose);
        }

        return true;
    }

    /// <summary>
    /// Tests if the API key is valid by making a simple request
    /// </summary>
    private async Task<bool> TestApiKeyAsync(string apiKey, bool verbose)
    {
        Console.WriteLine("Testing API key...");

        try
        {
            var testClient = new ChatClient("gpt-4o-mini", apiKey);
            var messages = new List<ChatMessage>
            {
                new SystemChatMessage("You are a helpful assistant."),
                new UserChatMessage("Say 'API key is valid' if you can read this."),
            };

            var response = await testClient.CompleteChatAsync(messages);

            if (response.Value != null)
            {
                Console.WriteLine("✅ API key is valid and working!");
                return true;
            }
            else
            {
                Console.WriteLine("❌ API key test failed: No response received");
                return false;
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine($"❌ API key test failed: {ex.Message}");
            if (verbose)
            {
                Console.WriteLine($"Full error: {ex}");
            }
            return false;
        }
    }

    /// <summary>
    /// Sets Unix file permissions to 600 (owner read/write only)
    /// </summary>
    private void SetUnixFilePermissions(string filePath)
    {
        // Only try to set Unix file permissions on Unix-based systems
        if (OperatingSystem.IsLinux() || OperatingSystem.IsMacOS())
        {
            try
            {
#if !WINDOWS
                File.SetUnixFileMode(filePath, UnixFileMode.UserRead | UnixFileMode.UserWrite);
#endif
            }
            catch
            {
                // Silently ignore if setting permissions fails
            }
        }
    }

    /// <summary>
    /// Reads input from console with masking
    /// </summary>
    private string ReadMaskedInput()
    {
        var input = "";
        ConsoleKeyInfo key;

        do
        {
            key = Console.ReadKey(true);

            if (key.Key != ConsoleKey.Backspace && key.Key != ConsoleKey.Enter)
            {
                input += key.KeyChar;
                Console.Write("*");
            }
            else if (key.Key == ConsoleKey.Backspace && input.Length > 0)
            {
                input = input.Substring(0, input.Length - 1);
                Console.Write("\b \b");
            }
        } while (key.Key != ConsoleKey.Enter);

        return input;
    }
}
