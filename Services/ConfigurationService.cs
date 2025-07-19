using System.Text.Json;
using OpenAI.Chat;
using Azure.AI.OpenAI;
using System.ClientModel;
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
    /// Gets the configured OpenAI endpoint or null if not set
    /// </summary>
    public async Task<string?> GetOpenAiEndpointAsync()
    {
        var config = await LoadConfigurationAsync();
        return config?.OpenAiEndpoint;
    }

    /// <summary>
    /// Gets the configured default model or null if not set
    /// </summary>
    public async Task<string?> GetDefaultModelAsync()
    {
        var config = await LoadConfigurationAsync();
        return config?.DefaultModel;
    }

    /// <summary>
    /// Returns true if configuration specifies Azure OpenAI usage
    /// </summary>
    public async Task<bool> UseAzureOpenAIAsync()
    {
        var config = await LoadConfigurationAsync();
        return config?.UseAzureOpenAI ?? false;
    }

    /// <summary>
    /// Prompts user to enter and save their OpenAI API key
    /// </summary>
    public async Task<bool> SetupApiKeyAsync(bool verbose = false)
    {
        Console.WriteLine("WriteCommit Setup");
        Console.WriteLine("=================");
        Console.WriteLine();
        Console.WriteLine("Please enter your OpenAI API key (or Azure OpenAI key).");
        Console.WriteLine("You can get one from: https://platform.openai.com/api-keys or your Azure portal");
        Console.WriteLine();
        Console.Write("API Key (leave blank if not required): ");

        // Read API key with masked input
        var apiKey = ReadMaskedInput();
        Console.WriteLine();

        if (string.IsNullOrWhiteSpace(apiKey))
        {
            apiKey = null;
        }

        // Ask if using Azure OpenAI
        Console.Write("Use Azure OpenAI service? (y/N): ");
        var azureInput = Console.ReadLine()?.Trim().ToLowerInvariant();
        bool useAzure = azureInput == "y" || azureInput == "yes";

        // Prompt for endpoint and model/deployment
        Console.Write(
            useAzure
                ? "Azure endpoint (e.g. https://your-resource.openai.azure.com): "
                : "Endpoint (default: https://api.openai.com/v1): "
        );
        var endpointInput = Console.ReadLine()?.Trim();
        var endpoint = string.IsNullOrWhiteSpace(endpointInput)
            ? (useAzure ? "https://your-resource.openai.azure.com" : "https://api.openai.com/v1")
            : endpointInput;

        Console.Write(
            useAzure
                ? "Deployment name (default: gpt-4o-mini): "
                : "Default model (default: gpt-4o-mini): "
        );
        var modelInput = Console.ReadLine()?.Trim();
        var model = string.IsNullOrWhiteSpace(modelInput) ? "gpt-4o-mini" : modelInput;

        // Load existing config or create new one
        var config = await LoadConfigurationAsync() ?? new AppConfiguration();
        config.OpenAiApiKey = apiKey;
        config.OpenAiEndpoint = endpoint;
        config.DefaultModel = model;
        config.UseAzureOpenAI = useAzure;

        // Save configuration
        await SaveConfigurationAsync(config);

        Console.WriteLine($"✅ Configuration saved to {_configFilePath}");

        if (verbose)
        {
            Console.WriteLine("Configuration saved successfully.");
            Console.WriteLine($"Config location: {_configFilePath}");
        }

        // Optionally test the API key
        Console.WriteLine();
        Console.Write("Would you like to test the API key? (y/N): ");
        var testResponse = Console.ReadLine()?.Trim().ToLowerInvariant();

        if ((testResponse == "y" || testResponse == "yes") && !string.IsNullOrEmpty(apiKey))
        {
            return await TestApiKeyAsync(apiKey, useAzure, endpoint, model, verbose);
        }

        return true;
    }

    /// <summary>
    /// Tests if the API key is valid by making a simple request
    /// </summary>
    private async Task<bool> TestApiKeyAsync(string? apiKey, bool useAzure, string endpoint, string model, bool verbose)
    {
        Console.WriteLine("Testing API key...");

        try
        {
            ChatClient testClient;
            if (useAzure)
            {
                var azureClient = new Azure.AI.OpenAI.AzureOpenAIClient(new Uri(endpoint), new ApiKeyCredential(apiKey));
                testClient = azureClient.GetChatClient(model);
            }
            else
            {
                var options = new OpenAI.OpenAIClientOptions { Endpoint = new Uri(endpoint) };
                testClient = new ChatClient(model, new ApiKeyCredential(apiKey), options);
            }
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
