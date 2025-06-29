using TiktokenSharp;

namespace WriteCommit.Services;

public static class TokenHelper
{
    private static readonly Dictionary<string, TikToken> Encoders = new();

    public static int EstimateTokens(string text, string model)
    {
        try
        {
            if (!Encoders.TryGetValue(model, out var encoder))
            {
                encoder = TikToken.EncodingForModel(model);
                Encoders[model] = encoder;
            }
            return encoder.Encode(text).Count;
        }
        catch
        {
            // Fallback heuristic
            return Math.Max(1, text.Length / 4);
        }
    }
}
