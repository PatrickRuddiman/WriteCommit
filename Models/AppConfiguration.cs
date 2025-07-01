using System.Text.Json.Serialization;

namespace WriteCommit.Models;

public class AppConfiguration
{
    [JsonPropertyName("openai_api_key")]
    public string? OpenAiApiKey { get; set; }

    [JsonPropertyName("default_model")]
    public string? DefaultModel { get; set; }

    [JsonPropertyName("openai_endpoint")]
    public string? OpenAiEndpoint { get; set; }

    [JsonPropertyName("default_temperature")]
    public int? DefaultTemperature { get; set; }

    [JsonPropertyName("default_topp")]
    public int? DefaultTopP { get; set; }
}
