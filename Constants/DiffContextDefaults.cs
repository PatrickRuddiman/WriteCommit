namespace WriteCommit.Constants;

/// <summary>
/// Default thresholds used when analyzing diffs.
/// </summary>
public static class DiffContextDefaults
{
    /// <summary>
    /// Maximum number of files considered a "small" diff.
    /// </summary>
    public const int SmallDiffFileThreshold = 2;

    /// <summary>
    /// Maximum total line count considered a "small" diff.
    /// </summary>
    public const int SmallDiffLineThreshold = 20;

    /// <summary>
    /// Extra context lines to fetch around changes in small diffs.
    /// </summary>
    public const int ExtraContextLines = 10;
}
